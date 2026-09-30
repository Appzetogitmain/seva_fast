import Category from "../../models/category.js";

const LEVEL_LABELS = {
  header: "Header category",
  category: "Main category",
  subcategory: "Sub-category",
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const findCategoryTool = {
  name: "find_category",
  description:
    "Check whether a category or sub-category exists on the platform by name. ALWAYS use this when the user asks if a category exists / is available. Pass the English name.",
  parameters: {
    type: "OBJECT",
    properties: {
      name: {
        type: "STRING",
        description: "Category name or keyword to look for (e.g. 'dairy', 'snacks', 'hair oil').",
      },
    },
    required: ["name"],
  },
};

const runSearch = (pattern, activeOnly) =>
  Category.find({
    name: { $regex: pattern, $options: "i" },
    ...(activeOnly ? { status: "active" } : {}),
  })
    .limit(8)
    .select("name type status parentId")
    .populate("parentId", "name")
    .lean();

export async function findCategories(name, { activeOnly = false } = {}) {
  const clean = String(name || "").trim().slice(0, 60);
  if (!clean) return { error: "Category name is required." };

  let matches = await runSearch(escapeRegex(clean), activeOnly);

  // Fallback so "fruits" still finds "Fruit & Vegetables" and
  // "hair oils" finds "Hair Oil": match any word, ignoring a plural "s".
  if (matches.length === 0) {
    const words = clean
      .split(/\s+/)
      .map((w) => w.replace(/s$/i, ""))
      .filter((w) => w.length >= 3)
      .map(escapeRegex);
    if (words.length > 0) {
      matches = await runSearch(words.join("|"), activeOnly);
    }
  }

  if (matches.length === 0) return { exists: false, searchedFor: clean };

  return {
    exists: true,
    matches: matches.map((c) => ({
      name: c.name,
      level: LEVEL_LABELS[c.type] || c.type,
      parent: c.parentId?.name || undefined,
      status: c.status,
    })),
  };
}
