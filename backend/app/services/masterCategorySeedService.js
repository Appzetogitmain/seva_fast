import Category from "../models/category.js";
import { invalidate } from "../services/cacheService.js";

const makeSlug = (text) =>
  String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const MASTER_CATEGORIES_DATA = [
  {
    name: "Grocery",
    slug: "grocery",
    iconId: "grocery",
    headerColor: "#FF9F1C",
    headerFontColor: "#ffffff",
    headerIconColor: "#ffffff",
    categories: [
      {
        name: "Flour, Rice & Grains",
        slug: "flour-rice-grains",
        iconId: "grain",
        subcategories: [
          "Wheat", "Atta", "Maida", "Suji", "Besan", "Rice", "Poha", "Dalia", "Bajra", "Jowar", "Ragi", "Corn"
        ]
      },
      {
        name: "Pulses & Lentils",
        slug: "pulses-lentils",
        iconId: "grain",
        subcategories: [
          "Toor Dal", "Moong Dal", "Masoor Dal", "Chana Dal", "Urad Dal", "Rajma", "Chickpeas", "Kabuli Chana", "Peas"
        ]
      },
      {
        name: "Cooking Oil & Ghee",
        slug: "cooking-oil-ghee",
        iconId: "oil",
        subcategories: [
          "Mustard Oil", "Refined Oil", "Desi Ghee", "Sunflower Oil", "Olive Oil", "Groundnut Oil"
        ]
      },
      {
        name: "Spices & Masalas",
        slug: "spices-masalas",
        iconId: "spice",
        subcategories: [
          "Whole Spices", "Powdered Spices", "Blended Masalas", "Turmeric & Chilli", "Coriander & Cumin", "Garam Masala"
        ]
      },
      {
        name: "Salt & Sugar",
        slug: "salt-sugar",
        iconId: "salt",
        subcategories: [
          "Table Salt", "Rock Salt / Sendha Namak", "White Sugar", "Jaggery / Gur", "Brown Sugar"
        ]
      },
      {
        name: "Tea, Coffee & Beverages",
        slug: "tea-coffee-beverages",
        iconId: "tea",
        subcategories: [
          "Tea Leaves & Bags", "Instant Coffee", "Green Tea", "Health Drinks & Malt"
        ]
      },
      {
        name: "Biscuits & Snacks",
        slug: "biscuits-snacks",
        iconId: "snack",
        subcategories: [
          "Cookies & Biscuits", "Namkeen & Bhujia", "Potato Chips", "Popcorn", "Rusks & Toast"
        ]
      },
      {
        name: "Breakfast Foods",
        slug: "breakfast-foods",
        iconId: "breakfast",
        subcategories: [
          "Oats & Muesli", "Corn Flakes", "Poha & Upma Mixes", "Pancake Mixes"
        ]
      },
      {
        name: "Dry Fruits & Nuts",
        slug: "dry-fruits-nuts",
        iconId: "nuts",
        subcategories: [
          "Almonds / Badam", "Cashews / Kaju", "Raisins / Kishmish", "Walnuts / Akhrot", "Pistachios / Pista", "Dates / Khajoor"
        ]
      },
      {
        name: "Sauces & Spreads",
        slug: "sauces-spreads",
        iconId: "sauce",
        subcategories: [
          "Tomato Ketchup", "Mayonnaise", "Jam & Honey", "Peanut Butter", "Pasta & Pizza Sauce"
        ]
      },
      {
        name: "Pickles & Papad",
        slug: "pickles-papad",
        iconId: "pickle",
        subcategories: [
          "Mango Pickle", "Lemon Pickle", "Mixed Veg Pickle", "Papads & Fryums"
        ]
      },
      {
        name: "Instant & Packaged Food",
        slug: "instant-packaged-food",
        iconId: "noodle",
        subcategories: [
          "Instant Noodles", "Pasta & Macaroni", "Ready to Eat Meals", "Soup Mixes"
        ]
      },
      {
        name: "Dairy & Refrigerated",
        slug: "dairy-refrigerated",
        iconId: "milk",
        subcategories: [
          "Fresh Milk", "Curd & Dahi", "Paneer & Tofu", "Butter & Cream", "Cheese Slices & Cubes"
        ]
      },
      {
        name: "Bakery & Sweets",
        slug: "bakery-sweets",
        iconId: "cake",
        subcategories: [
          "Fresh Bread & Bun", "Cakes & Muffins", "Indian Sweets", "Chocolates"
        ]
      },
      {
        name: "Frozen Food",
        slug: "frozen-food",
        iconId: "icecream",
        subcategories: [
          "Frozen Peas & Veggies", "Frozen Snacks & Fries", "Ice Creams & Kulfi"
        ]
      },
      {
        name: "Baby Food",
        slug: "baby-food",
        iconId: "baby",
        subcategories: [
          "Infant Cereals", "Baby Formula Milk", "Baby Snacks"
        ]
      },
      {
        name: "Pooja & Religious Supplies",
        slug: "pooja-religious-supplies",
        iconId: "pooja",
        subcategories: [
          "Agarbatti & Dhoop", "Pooja Oil & Ghee", "Camphor & Matchboxes", "Diya & Cotton Wicks"
        ]
      },
      {
        name: "Home Cleaning",
        slug: "home-cleaning",
        iconId: "clean",
        subcategories: [
          "Floor Cleaners", "Dishwash Liquids & Bars", "Toilet Cleaners", "Glass Cleaners"
        ]
      },
      {
        name: "Laundry Care",
        slug: "laundry-care",
        iconId: "laundry",
        subcategories: [
          "Detergent Powder", "Liquid Detergent", "Fabric Softener", "Detergent Bars"
        ]
      },
      {
        name: "Paper & Disposable Products",
        slug: "paper-disposable-products",
        iconId: "paper",
        subcategories: [
          "Tissue Papers & Napkins", "Toilet Roll", "Aluminum Foil & Cling Wrap", "Garbage Bags"
        ]
      },
      {
        name: "Personal Care",
        slug: "personal-care",
        iconId: "soap",
        subcategories: [
          "Soaps & Body Wash", "Shampoos & Conditioners", "Toothpaste & Toothbrush", "Hand Wash & Sanitizers"
        ]
      },
      {
        name: "Water & Soft Drinks",
        slug: "water-soft-drinks",
        iconId: "drink",
        subcategories: [
          "Mineral Water", "Carbonated Soft Drinks", "Fruit Juices", "Energy & Sports Drinks"
        ]
      },
      {
        name: "Fresh Fruits & Vegetables",
        slug: "fresh-fruits-vegetables",
        iconId: "fruit",
        subcategories: [
          "Fresh Vegetables", "Fresh Fruits", "Exotic Fruits & Veggies", "Leafy Greens"
        ]
      },
      {
        name: "Eggs & Non-Veg",
        slug: "eggs-non-veg",
        iconId: "egg",
        subcategories: [
          "Fresh Farm Eggs", "Organic & Brown Eggs", "Chicken & Poultry", "Fish & Seafood"
        ]
      },
      {
        name: "Household Essentials",
        slug: "household-essentials",
        iconId: "home",
        subcategories: [
          "Pest Control", "Air Fresheners", "Batteries & Bulbs", "Cleaning Tools & Mops"
        ]
      }
    ]
  },
  {
    name: "Electronics",
    slug: "electronics",
    iconId: "electronics",
    headerColor: "#7209B7",
    headerFontColor: "#ffffff",
    headerIconColor: "#ffffff",
    categories: [
      {
        name: "Mobiles & Accessories",
        slug: "mobiles-accessories",
        subcategories: ["Mobile Covers", "Screen Protectors", "Charging Cables", "Adapters & Fast Chargers", "Power Banks"]
      },
      {
        name: "Headphones & Audio",
        slug: "headphones-audio",
        subcategories: ["Wireless Earbuds (TWS)", "Neckbands", "Over-Ear Headphones", "Bluetooth Speakers"]
      },
      {
        name: "Smart Wearables",
        slug: "smart-wearables",
        subcategories: ["Smartwatches", "Fitness Bands", "Smartwatch Straps"]
      },
      {
        name: "Computer & Laptop Accessories",
        slug: "computer-laptop-accessories",
        subcategories: ["Wireless Mouse", "Keyboards", "USB Hubs", "Laptop Stands", "Pendrives & Hard Drives"]
      },
      {
        name: "Personal Appliances",
        slug: "personal-appliances",
        subcategories: ["Hair Dryers", "Hair Straighteners", "Beard Trimmers & Shavers", "Electric Toothbrushes"]
      }
    ]
  },
  {
    name: "Beauty & Cosmetics",
    slug: "beauty-cosmetics",
    iconId: "spa",
    headerColor: "#FF4D6D",
    headerFontColor: "#ffffff",
    headerIconColor: "#ffffff",
    categories: [
      {
        name: "Skin Care",
        slug: "skin-care",
        subcategories: ["Face Wash & Cleansers", "Moisturizers & Body Lotions", "Sunscreens", "Face Serums & Sheet Masks"]
      },
      {
        name: "Hair Care",
        slug: "hair-care",
        subcategories: ["Shampoos", "Hair Conditioners", "Hair Oils", "Hair Serums & Color"]
      },
      {
        name: "Make Up",
        slug: "make-up",
        subcategories: ["Lipsticks & Lip Balms", "Kajal & Eyeliner", "Foundations & Compact", "Nail Polish"]
      },
      {
        name: "Fragrances & Deos",
        slug: "fragrances-deos",
        subcategories: ["Deodorants", "Perfumes (EDP/EDT)", "Body Sprays & Roll-ons"]
      }
    ]
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    iconId: "kitchen",
    headerColor: "#BC6C25",
    headerFontColor: "#ffffff",
    headerIconColor: "#ffffff",
    categories: [
      {
        name: "Cookware & Kitchenware",
        slug: "cookware-kitchenware",
        subcategories: ["Non-stick Pans & Kadai", "Pressure Cookers", "Kitchen Tools & Cutlery", "Chopping Boards & Knives"]
      },
      {
        name: "Storage & Containers",
        slug: "storage-containers",
        subcategories: ["Air-tight Containers", "Water Bottles & Flasks", "Lunch Boxes", "Spice Boxes"]
      },
      {
        name: "Home Decor & Furnishing",
        slug: "home-decor-furnishing",
        subcategories: ["Bedsheets & Pillow Covers", "Towels & Napkins", "Curtains", "Wall Clocks & Decor"]
      }
    ]
  },
  {
    name: "Baby Care",
    slug: "baby-care",
    iconId: "baby",
    headerColor: "#4EA8DE",
    headerFontColor: "#ffffff",
    headerIconColor: "#ffffff",
    categories: [
      {
        name: "Diapers & Wipes",
        slug: "diapers-wipes",
        subcategories: ["Pants Diapers", "Tape Diapers", "Baby Wet Wipes", "Diaper Rash Creams"]
      },
      {
        name: "Baby Bath & Skin",
        slug: "baby-bath-skin",
        subcategories: ["Baby Soaps & Body Wash", "Baby Shampoo", "Baby Oils & Lotions", "Baby Powder"]
      },
      {
        name: "Baby Nursing & Feeding",
        slug: "baby-nursing-feeding",
        subcategories: ["Feeding Bottles", "Teethers & Pacifiers", "Sterilizers & Warmers"]
      }
    ]
  },
  {
    name: "Pet Care",
    slug: "pet-care",
    iconId: "pets",
    headerColor: "#52B788",
    headerFontColor: "#ffffff",
    headerIconColor: "#ffffff",
    categories: [
      {
        name: "Dog Supplies",
        slug: "dog-supplies",
        subcategories: ["Dog Food (Dry/Wet)", "Dog Treats & Chews", "Dog Shampoo & Grooming", "Dog Toys & Leashes"]
      },
      {
        name: "Cat Supplies",
        slug: "cat-supplies",
        subcategories: ["Cat Food", "Cat Litter & Trays", "Cat Toys"]
      }
    ]
  }
];

export async function seedMasterCategories() {
  let headersCount = 0;
  let categoriesCount = 0;
  let subcategoriesCount = 0;

  for (const headerItem of MASTER_CATEGORIES_DATA) {
    // 1. Upsert Header Category (by name or slug)
    let headerDoc = await Category.findOne({
      $or: [{ slug: headerItem.slug }, { name: headerItem.name }],
      type: "header"
    });

    if (!headerDoc) {
      headerDoc = await Category.create({
        name: headerItem.name,
        slug: headerItem.slug,
        type: "header",
        parentId: null,
        iconId: headerItem.iconId || "",
        headerColor: headerItem.headerColor || "#FF9F1C",
        headerFontColor: headerItem.headerFontColor || "#ffffff",
        headerIconColor: headerItem.headerIconColor || "#ffffff",
        status: "active",
      });
    } else {
      headerDoc.name = headerItem.name;
      headerDoc.iconId = headerItem.iconId || headerDoc.iconId;
      headerDoc.headerColor = headerItem.headerColor || headerDoc.headerColor;
      headerDoc.status = "active";
      await headerDoc.save();
    }
    headersCount++;

    if (Array.isArray(headerItem.categories)) {
      for (const catItem of headerItem.categories) {
        const catBaseSlug = catItem.slug || makeSlug(catItem.name);
        
        let catDoc = await Category.findOne({
          name: catItem.name,
          type: "category",
          parentId: headerDoc._id
        });

        if (!catDoc) {
          catDoc = await Category.findOne({ slug: catBaseSlug });
        }

        if (!catDoc) {
          catDoc = await Category.create({
            name: catItem.name,
            slug: catBaseSlug,
            type: "category",
            parentId: headerDoc._id,
            iconId: catItem.iconId || "",
            status: "active",
          });
        } else {
          catDoc.name = catItem.name;
          catDoc.parentId = headerDoc._id;
          catDoc.type = "category";
          catDoc.status = "active";
          await catDoc.save();
        }
        categoriesCount++;

        if (Array.isArray(catItem.subcategories)) {
          for (const subName of catItem.subcategories) {
            const subBaseSlug = makeSlug(subName);
            
            let subDoc = await Category.findOne({
              name: subName,
              type: "subcategory",
              parentId: catDoc._id
            });

            if (!subDoc) {
              subDoc = await Category.findOne({ slug: subBaseSlug });
            }

            if (!subDoc) {
              let finalSlug = subBaseSlug;
              const slugExists = await Category.findOne({ slug: finalSlug });
              if (slugExists) {
                finalSlug = `${catDoc.slug}-${subBaseSlug}`;
              }
              await Category.create({
                name: subName,
                slug: finalSlug,
                type: "subcategory",
                parentId: catDoc._id,
                status: "active",
              });
            } else {
              subDoc.name = subName;
              subDoc.parentId = catDoc._id;
              subDoc.type = "subcategory";
              subDoc.status = "active";
              await subDoc.save();
            }
            subcategoriesCount++;
          }
        }
      }
    }
  }

  // Clear Redis / cache
  try {
    await invalidate("cache:catalog:categories:*");
  } catch (err) {
    console.warn("Cache invalidate warning:", err.message);
  }

  return {
    headers: headersCount,
    categories: categoriesCount,
    subcategories: subcategoriesCount,
  };
}
