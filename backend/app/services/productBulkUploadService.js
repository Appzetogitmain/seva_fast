import XLSX from "xlsx";
import Product from "../models/product.js";
import Category from "../models/category.js";
import { slugify } from "../utils/slugify.js";
import {
  getProductApprovalConfig,
  PRODUCT_APPROVAL_STATUS,
} from "./productModerationService.js";
import { enqueueProductIndex } from "./searchSyncService.js";
import { buildKey, invalidate } from "./cacheService.js";

const TEMPLATE_HEADERS = [
  "name",
  "description",
  "brand",
  "sku",
  "price",
  "salePrice",
  "stock",
  "lowStockAlert",
  "header",
  "category",
  "subcategory",
  "weight",
  "deliveryType",
  "packageLength",
  "packageBreadth",
  "packageHeight",
  "tags",
  "mainImage",
  "status",
  "variantsJson",
  "variant1Name",
  "variant1Price",
  "variant1SalePrice",
  "variant1Stock",
  "variant1Sku",
  "variant2Name",
  "variant2Price",
  "variant2SalePrice",
  "variant2Stock",
  "variant2Sku",
  "variant3Name",
  "variant3Price",
  "variant3SalePrice",
  "variant3Stock",
  "variant3Sku",
];

const SAMPLE_ROWS = [
  {
    name: "Sample Organic Milk 1L",
    description: "Fresh organic cow milk, 1 litre pack",
    brand: "FarmFresh",
    sku: "",
    price: 60,
    salePrice: 55,
    stock: 100,
    lowStockAlert: 10,
    header: "Grocery",
    category: "Dairy",
    subcategory: "Milk",
    weight: "1 kg",
    deliveryType: "instant",
    packageLength: "",
    packageBreadth: "",
    packageHeight: "",
    tags: "milk,dairy,organic",
    mainImage: "https://example.com/images/milk.jpg",
    status: "active",
    variantsJson: "",
    variant1Name: "",
    variant1Price: "",
    variant1SalePrice: "",
    variant1Stock: "",
    variant1Sku: "",
    variant2Name: "",
    variant2Price: "",
    variant2SalePrice: "",
    variant2Stock: "",
    variant2Sku: "",
    variant3Name: "",
    variant3Price: "",
    variant3SalePrice: "",
    variant3Stock: "",
    variant3Sku: "",
  },
  {
    name: "Sample Cotton T-Shirt",
    description: "Comfortable cotton tee for everyday wear",
    brand: "StyleCo",
    sku: "",
    price: 499,
    salePrice: 399,
    stock: 50,
    lowStockAlert: 5,
    header: "Fashion",
    category: "Men",
    subcategory: "T-Shirts",
    weight: "0.3 kg",
    deliveryType: "scheduled",
    packageLength: 30,
    packageBreadth: 25,
    packageHeight: 5,
    tags: "apparel,cotton",
    mainImage: "",
    status: "active",
    variantsJson: "",
    variant1Name: "Size S",
    variant1Price: 499,
    variant1SalePrice: 399,
    variant1Stock: 20,
    variant1Sku: "",
    variant2Name: "Size M",
    variant2Price: 499,
    variant2SalePrice: 399,
    variant2Stock: 15,
    variant2Sku: "",
    variant3Name: "Size L",
    variant3Price: 499,
    variant3SalePrice: 399,
    variant3Stock: 15,
    variant3Sku: "",
  },
];

const MAX_BULK_ROWS = 500;

function cellStr(row, key) {
  const val = row?.[key];
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

function cellNum(row, key, fallback = null) {
  const raw = row?.[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function makeProductSku(name, index = 1) {
  const prefix =
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5) || "item";
  return `${prefix}-${String(index).padStart(3, "0")}-${Date.now().toString(36).slice(-4)}`;
}

function parseWeightKgFromString(weightStr) {
  const raw = String(weightStr || "").trim();
  if (!raw) return null;
  let val = parseFloat(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(val) || val <= 0) return null;
  if (raw.toLowerCase().includes("gm") || raw.toLowerCase().includes("gram")) {
    val = val / 1000;
  }
  return val;
}

function parsePositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeUrl(value) {
  const normalized = String(value || "").trim();
  if (!/^https?:\/\//i.test(normalized)) return "";
  return normalized;
}

function buildSellerPendingModerationUpdate() {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
    approvalRequestedAt: new Date(),
    approvalReviewedAt: null,
    approvalReviewedBy: null,
    approvalNote: "",
    lastSubmittedByRole: "seller",
  };
}

function buildSellerApprovedModerationUpdate() {
  return {
    approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED,
    approvalRequestedAt: null,
    approvalReviewedAt: null,
    approvalReviewedBy: null,
    approvalNote: "",
    lastSubmittedByRole: "seller",
  };
}

/**
 * Build category lookup maps: header name → id, and nested category/subcategory names.
 */
async function buildCategoryLookup() {
  const cats = await Category.find({ status: { $ne: "inactive" } })
    .select("_id name type parentId")
    .lean();

  const byId = new Map(cats.map((c) => [String(c._id), c]));
  const headersByName = new Map();
  const categoriesByParentAndName = new Map();
  const subcategoriesByParentAndName = new Map();
  const categoriesByName = new Map();
  const subcategoriesByName = new Map();

  const key = (parentId, name) =>
    `${String(parentId || "").toLowerCase()}::${String(name || "").trim().toLowerCase()}`;

  for (const c of cats) {
    const nameKey = String(c.name || "").trim().toLowerCase();
    if (!nameKey) continue;
    if (c.type === "header") {
      if (!headersByName.has(nameKey)) headersByName.set(nameKey, c);
    } else if (c.type === "category") {
      categoriesByParentAndName.set(key(c.parentId, c.name), c);
      if (!categoriesByName.has(nameKey)) categoriesByName.set(nameKey, []);
      categoriesByName.get(nameKey).push(c);
    } else if (c.type === "subcategory") {
      subcategoriesByParentAndName.set(key(c.parentId, c.name), c);
      if (!subcategoriesByName.has(nameKey)) subcategoriesByName.set(nameKey, []);
      subcategoriesByName.get(nameKey).push(c);
    }
  }

  const getHeaderForCategory = (category) => {
    if (!category?.parentId) return null;
    return byId.get(String(category.parentId)) || null;
  };

  return {
    byId,
    headersByName,
    categoriesByParentAndName,
    subcategoriesByParentAndName,
    resolve(headerName, categoryName, subcategoryName) {
      const hName = String(headerName || "").trim().toLowerCase();
      const cName = String(categoryName || "").trim().toLowerCase();
      const sName = String(subcategoryName || "").trim().toLowerCase();

      if (!cName && !sName) return { error: "category or subcategory name is required" };

      // Path 1: exact header+category when both are valid
      if (hName && cName) {
        const header = headersByName.get(hName);
        if (header) {
          const category = categoriesByParentAndName.get(key(header._id, categoryName));
          if (category) {
            let subcategoryId = null;
            if (sName) {
              const sub = subcategoriesByParentAndName.get(key(category._id, subcategoryName));
              if (!sub) {
                return {
                  error: `Subcategory "${subcategoryName}" not found under "${categoryName}".`,
                };
              }
              subcategoryId = sub._id;
            }
            return {
              headerId: header._id,
              categoryId: category._id,
              subcategoryId,
            };
          }
        }
      }

      // Path 2: resolve by subcategory name (and infer category/header)
      if (sName) {
        const subCandidates = subcategoriesByName.get(sName) || [];
        if (subCandidates.length === 1) {
          const sub = subCandidates[0];
          const category = byId.get(String(sub.parentId));
          const header = getHeaderForCategory(category);
          if (category && header) {
            if (cName && String(category.name || "").trim().toLowerCase() !== cName) {
              return {
                error: `Subcategory "${subcategoryName}" belongs to category "${category.name}", but got "${categoryName}".`,
              };
            }
            return {
              headerId: header._id,
              categoryId: category._id,
              subcategoryId: sub._id,
            };
          }
        } else if (subCandidates.length > 1) {
          return {
            error: `Subcategory "${subcategoryName}" exists under multiple categories. Please provide exact header and category.`,
          };
        }
      }

      // Path 3: resolve by category name (and infer header)
      if (cName) {
        let categoryCandidates = categoriesByName.get(cName) || [];
        if (hName) {
          const header = headersByName.get(hName);
          if (header) {
            categoryCandidates = categoryCandidates.filter(
              (candidate) => String(candidate.parentId) === String(header._id),
            );
          }
        }

        if (categoryCandidates.length === 1) {
          const category = categoryCandidates[0];
          const header = getHeaderForCategory(category);
          if (!header) {
            return { error: `Header not found for category "${categoryName}".` };
          }

          let subcategoryId = null;
          if (sName) {
            const sub = subcategoriesByParentAndName.get(key(category._id, subcategoryName));
            if (!sub) {
              return {
                error: `Subcategory "${subcategoryName}" not found under "${category.name}".`,
              };
            }
            subcategoryId = sub._id;
          }
          return {
            headerId: header._id,
            categoryId: category._id,
            subcategoryId,
          };
        }

        if (categoryCandidates.length > 1) {
          return {
            error: `Category "${categoryName}" exists in multiple headers. Please fill header column as well.`,
          };
        }
      }

      return {
        error: `Could not resolve category mapping for header "${headerName}" and category "${categoryName}". Use exact names from your category tree.`,
      };
    },
  };
}

function normalizeRowHeaders(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    const key = String(k || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    // Map common aliases
    const aliases = {
      productname: "name",
      product: "name",
      title: "name",
      maingroup: "header",
      group: "header",
      headername: "header",
      categoryname: "category",
      subcategoryname: "subcategory",
      saleprice: "salePrice",
      lowstock: "lowStockAlert",
      lowstockalert: "lowStockAlert",
      delivery: "deliveryType",
      deliverytype: "deliveryType",
      packagelength: "packageLength",
      packagebreadth: "packageBreadth",
      packageheight: "packageHeight",
      mainimage: "mainImage",
      image: "mainImage",
      imageurl: "mainImage",
      variants: "variantsJson",
      variantsjson: "variantsJson",
    };
    out[aliases[key] || key] = v;
  }
  return out;
}

function parseVariantsFromColumns(row, productName, rowIndexForSku) {
  const variants = [];
  for (let i = 1; i <= 3; i++) {
    const name = cellStr(row, `variant${i}Name`);
    const price = cellNum(row, `variant${i}Price`, null);
    const salePrice = cellNum(row, `variant${i}SalePrice`, 0);
    const stock = cellNum(row, `variant${i}Stock`, null);
    const sku = cellStr(row, `variant${i}Sku`);

    if (!name && price === null && stock === null && !sku) {
      continue;
    }
    if (!name) {
      return { error: `variant${i}Name is required when variant ${i} is provided` };
    }
    if (price === null || price < 0) {
      return { error: `variant${i}Price must be a valid number (>= 0)` };
    }
    if (stock === null || stock < 0) {
      return { error: `variant${i}Stock must be a valid number (>= 0)` };
    }

    variants.push({
      name,
      price,
      salePrice: salePrice < 0 ? 0 : salePrice,
      stock: Math.floor(stock),
      sku: sku || makeProductSku(productName, rowIndexForSku + i),
    });
  }
  return { variants };
}

function parseVariants(row, productName, rowIndexForSku) {
  const variantsJsonRaw = cellStr(row, "variantsJson");
  if (variantsJsonRaw) {
    try {
      const parsed = JSON.parse(variantsJsonRaw);
      if (!Array.isArray(parsed)) {
        return { error: "variantsJson must be a JSON array" };
      }
      const variants = [];
      for (let i = 0; i < parsed.length; i++) {
        const v = parsed[i] || {};
        const name = String(v.name || "").trim();
        const price = Number(v.price);
        const salePrice = Number(v.salePrice ?? 0);
        const stock = Number(v.stock);
        const sku = String(v.sku || "").trim();

        if (!name) return { error: `variantsJson[${i}].name is required` };
        if (!Number.isFinite(price) || price < 0) {
          return { error: `variantsJson[${i}].price must be >= 0` };
        }
        if (!Number.isFinite(stock) || stock < 0) {
          return { error: `variantsJson[${i}].stock must be >= 0` };
        }

        variants.push({
          name,
          price,
          salePrice: Number.isFinite(salePrice) && salePrice >= 0 ? salePrice : 0,
          stock: Math.floor(stock),
          sku: sku || makeProductSku(productName, rowIndexForSku + i + 1),
        });
      }
      return { variants };
    } catch {
      return { error: "Invalid variantsJson. Use valid JSON array format." };
    }
  }

  return parseVariantsFromColumns(row, productName, rowIndexForSku);
}

function validateScheduledFields(productData) {
  const deliveryType = String(productData.deliveryType || "instant").toLowerCase();
  if (deliveryType !== "scheduled") return null;

  if (!parseWeightKgFromString(productData.weight)) {
    return "Weight is required for scheduled nationwide delivery products";
  }

  const length = parsePositiveNumber(productData.packageLength);
  const breadth = parsePositiveNumber(productData.packageBreadth);
  const height = parsePositiveNumber(productData.packageHeight);

  if (!length || !breadth || !height) {
    return "Package length, breadth and height (cm) are required for scheduled delivery";
  }

  productData.packageLength = length;
  productData.packageBreadth = breadth;
  productData.packageHeight = height;
  return null;
}

export function buildBulkTemplateBuffer() {
  const wb = XLSX.utils.book_new();

  const instructions = [
    ["Product Bulk Upload – Instructions"],
    [""],
    ["1. Fill the Products sheet. Do not rename column headers."],
    ["2. Required columns: name, price, stock, category"],
    ["3. header is optional but recommended when category names repeat."],
    ["4. category / subcategory must match exact names from your catalog Groups."],
    ["5. deliveryType: instant OR scheduled"],
    ["6. For scheduled delivery: weight + packageLength + packageBreadth + packageHeight (cm) are required."],
    ["7. mainImage: optional public image URL (https://...)"],
    ["8. tags: comma-separated (e.g. milk,dairy)"],
    ["9. sku: leave blank to auto-generate"],
    ["10. status: active or inactive (default active)"],
    ["11. Variants supported: fill variant1/2/3 columns OR variantsJson."],
    ["12. variantsJson format: [{\"name\":\"Size S\",\"price\":499,\"salePrice\":399,\"stock\":10,\"sku\":\"\"}]"],
    ["13. If variants are provided, product stock is auto-calculated from variant stocks."],
    ["14. Max 500 products per upload. Replace sample rows with your real products."],
    [""],
    ["Tip: Download fresh template, keep the header row, delete sample rows, then upload."],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  const productRows = [TEMPLATE_HEADERS, ...SAMPLE_ROWS.map((r) => TEMPLATE_HEADERS.map((h) => r[h] ?? ""))];
  const wsProducts = XLSX.utils.aoa_to_sheet(productRows);
  wsProducts["!cols"] = TEMPLATE_HEADERS.map((h) => ({
    wch: Math.max(12, String(h).length + 2),
  }));
  XLSX.utils.book_append_sheet(wb, wsProducts, "Products");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export function parseBulkWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName =
    wb.SheetNames.find((n) => String(n).toLowerCase() === "products") ||
    wb.SheetNames.find((n) => String(n).toLowerCase() !== "instructions") ||
    wb.SheetNames[0];

  if (!sheetName) {
    throw new Error("Excel file has no sheets");
  }

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return rows.map(normalizeRowHeaders);
}

/**
 * Bulk-create products for a seller from parsed Excel rows.
 */
export async function bulkCreateProductsFromRows(rows, { sellerId }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      created: 0,
      failed: 0,
      errors: [{ row: 0, name: "", message: "No product rows found in the file" }],
      products: [],
    };
  }

  if (rows.length > MAX_BULK_ROWS) {
    return {
      created: 0,
      failed: rows.length,
      errors: [
        {
          row: 0,
          name: "",
          message: `Too many rows (${rows.length}). Maximum is ${MAX_BULK_ROWS} per upload.`,
        },
      ],
      products: [],
    };
  }

  const categoryLookup = await buildCategoryLookup();
  const approvalConfig = await getProductApprovalConfig();
  const moderationUpdate = approvalConfig.sellerCreateRequiresApproval
    ? buildSellerPendingModerationUpdate()
    : buildSellerApprovedModerationUpdate();

  const errors = [];
  const products = [];
  const batchNames = new Set();
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const excelRow = i + 2; // header is row 1
    const row = rows[i];
    const name = cellStr(row, "name");

    try {
      if (!name) {
        errors.push({ row: excelRow, name: "", message: "Product name is required" });
        continue;
      }

      const trimmedName = name.trim();
      const lowerName = trimmedName.toLowerCase();
      if (batchNames.has(lowerName)) {
        errors.push({ row: excelRow, name, message: `Duplicate product "${trimmedName}" in the same upload file` });
        continue;
      }

      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingProduct = await Product.findOne({
        sellerId,
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') }
      }).lean();

      if (existingProduct) {
        errors.push({ row: excelRow, name, message: `Product "${trimmedName}" already exists in your inventory` });
        continue;
      }

      batchNames.add(lowerName);

      const price = cellNum(row, "price");
      if (price === null || price < 0) {
        errors.push({ row: excelRow, name, message: "Valid price is required (≥ 0)" });
        continue;
      }

      const stock = cellNum(row, "stock", 0);
      if (stock === null || stock < 0) {
        errors.push({ row: excelRow, name, message: "Stock cannot be negative" });
        continue;
      }

      const headerName = cellStr(row, "header");
      const categoryName = cellStr(row, "category");
      const subcategoryName = cellStr(row, "subcategory");
      const resolved = categoryLookup.resolve(headerName, categoryName, subcategoryName);
      if (resolved.error) {
        errors.push({ row: excelRow, name, message: resolved.error });
        continue;
      }

      let deliveryType = cellStr(row, "deliveryType").toLowerCase() || "instant";
      if (deliveryType !== "instant" && deliveryType !== "scheduled") {
        errors.push({
          row: excelRow,
          name,
          message: 'deliveryType must be "instant" or "scheduled"',
        });
        continue;
      }

      let status = cellStr(row, "status").toLowerCase() || "active";
      if (status !== "active" && status !== "inactive") {
        status = "active";
      }

      const tagsRaw = cellStr(row, "tags");
      const tags = tagsRaw
        ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const parsedVariants = parseVariants(row, name, i + 1);
      if (parsedVariants.error) {
        errors.push({ row: excelRow, name, message: parsedVariants.error });
        continue;
      }
      const variants = parsedVariants.variants || [];

      const productData = {
        name,
        description: cellStr(row, "description"),
        brand: cellStr(row, "brand"),
        sku: cellStr(row, "sku") || makeProductSku(name, i + 1),
        price,
        salePrice: cellNum(row, "salePrice", 0) ?? 0,
        stock: Math.floor(stock),
        lowStockAlert: cellNum(row, "lowStockAlert", 5) ?? 5,
        headerId: resolved.headerId,
        categoryId: resolved.categoryId,
        subcategoryId: resolved.subcategoryId,
        weight: cellStr(row, "weight"),
        deliveryType,
        packageLength: cellNum(row, "packageLength", null),
        packageBreadth: cellNum(row, "packageBreadth", null),
        packageHeight: cellNum(row, "packageHeight", null),
        tags,
        mainImage: normalizeUrl(cellStr(row, "mainImage")) || undefined,
        status,
        sellerId,
        slug: `${slugify(name)}-${Date.now().toString(36)}-${i}`,
        variants,
        ...moderationUpdate,
      };

      if (Array.isArray(productData.variants) && productData.variants.length > 0) {
        productData.stock = productData.variants.reduce(
          (sum, variant) => sum + (Number(variant?.stock) || 0),
          0,
        );
      }

      const packageError = validateScheduledFields(productData);
      if (packageError) {
        errors.push({ row: excelRow, name, message: packageError });
        continue;
      }

      if (productData.salePrice < 0) productData.salePrice = 0;
      if (productData.lowStockAlert < 0) productData.lowStockAlert = 5;

      const product = await Product.create(productData);
      created += 1;
      products.push({
        row: excelRow,
        id: product._id,
        name: product.name,
        sku: product.sku,
        approvalStatus: product.approvalStatus,
      });

      if (product?._id) {
        try {
          await enqueueProductIndex(product._id.toString());
        } catch (e) {
          // non-fatal
        }
      }
    } catch (err) {
      let message = err?.message || "Failed to create product";
      if (err?.code === 11000) {
        message = "Slug or SKU already exists — use a unique sku or leave blank";
      }
      errors.push({ row: excelRow, name, message });
    }
  }

  try {
    await invalidate(buildKey("catalog", "productList", "*"));
    await invalidate("cache:offersections:public:*");
  } catch (cacheErr) {
    console.error("Cache invalidation error (bulkCreateProducts):", cacheErr);
  }

  return {
    created,
    failed: errors.length,
    errors,
    products,
    requiresApproval: Boolean(approvalConfig.sellerCreateRequiresApproval),
  };
}

export { TEMPLATE_HEADERS, MAX_BULK_ROWS };
