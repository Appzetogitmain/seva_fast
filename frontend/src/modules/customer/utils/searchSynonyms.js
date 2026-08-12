/**
 * Search Synonyms and Query Normalization for SevaFast Customer Search.
 * Maps common Hindi / Hinglish spoken and typed words to standard product terms.
 */

export const HINGLISH_SYNONYMS = {
    // Fruits & Vegetables
    'aam': ['mango', 'mangoes'],
    'mango': ['aam'],
    'kela': ['banana', 'bananas'],
    'banana': ['kela'],
    'seb': ['apple', 'apples'],
    'apple': ['seb'],
    'santra': ['orange', 'oranges'],
    'orange': ['santra'],
    'nimbu': ['lemon', 'lime'],
    'lemon': ['nimbu'],
    'aloo': ['potato', 'potatoes'],
    'potato': ['aloo'],
    'tamatar': ['tomato', 'tomatoes'],
    'tomato': ['tamatar'],
    'pyaz': ['onion', 'onions'],
    'pyaaz': ['onion', 'onions'],
    'onion': ['pyaz', 'pyaaz'],
    'adrak': ['ginger'],
    'lehsun': ['garlic'],
    'lasun': ['garlic'],
    'bhindi': ['lady finger', 'okra'],

    // Dairy & Grocery Daily Staples
    'doodh': ['milk', 'dairy'],
    'dudh': ['milk'],
    'milk': ['doodh', 'dudh'],
    'makhan': ['butter'],
    'butter': ['makhan'],
    'dahi': ['curd', 'yogurt'],
    'curd': ['dahi'],
    'paneer': ['paneer', 'cottage cheese'],
    'cheese': ['paneer'],
    'ghee': ['clarified butter', 'ghee'],
    'anda': ['egg', 'eggs'],
    'eegg': ['egg'],
    'egg': ['anda'],
    'eggs': ['anda'],

    // Grains, Rice, Atta & Spices
    'chawal': ['rice', 'basmati'],
    'rice': ['chawal'],
    'aata': ['wheat flour', 'atta'],
    'atta': ['wheat flour', 'aata'],
    'flour': ['atta'],
    'chini': ['sugar'],
    'cheeni': ['sugar'],
    'sugar': ['chini', 'cheeni'],
    'namak': ['salt'],
    'salt': ['namak'],
    'tel': ['oil', 'cooking oil'],
    'oil': ['tel'],
    'haldi': ['turmeric'],
    'mirch': ['chilli', 'chili'],
    'mirchi': ['chilli', 'chili'],
    'dhaniya': ['coriander'],
    'jeera': ['cumin'],

    // Beverages & Snacks
    'chai': ['tea', 'tea leaves'],
    'patti': ['tea leaves', 'tea'],
    'tea': ['chai'],
    'coffee': ['kofi'],
    'paani': ['water', 'mineral water'],
    'pani': ['water'],
    'water': ['pani', 'paani'],
    'biscuit': ['biscuits', 'cookies'],
    'biscuits': ['biscuit'],
    'maggi': ['noodles', 'instant noodles'],
    'noodle': ['maggi', 'noodles'],
    'noodles': ['maggi'],
    'sabun': ['soap', 'bath soap'],
    'soap': ['sabun'],
};

/**
 * Expand a search query string to include relevant Hinglish or English terms.
 * @param {string} query 
 * @returns {string[]} Array of search query terms to match against
 */
export function getExpandedSearchTerms(query) {
    if (!query || typeof query !== 'string') return [];
    const trimmed = query.trim().toLowerCase().replace(/[.,!?;]+$/, '');
    if (!trimmed) return [];

    const terms = new Set([trimmed]);
    const words = trimmed.split(/\s+/);

    // Add synonyms for each individual word in query
    words.forEach(word => {
        const syns = HINGLISH_SYNONYMS[word];
        if (syns && Array.isArray(syns)) {
            syns.forEach(s => terms.add(s));
        }
    });

    return Array.from(terms);
}

/**
 * Test if a product matches the query terms (checking name, category, brand, description, tags).
 * @param {Object} product 
 * @param {string} rawQuery 
 * @returns {boolean}
 */
export function matchProductWithQuery(product, rawQuery) {
    if (!rawQuery || !product) return true;

    const terms = getExpandedSearchTerms(rawQuery);
    const prodName = (product.name || '').toLowerCase();
    const prodBrand = (product.brand || '').toLowerCase();
    const prodDesc = (product.description || '').toLowerCase();
    const catName = (product.categoryId?.name || product.categoryName || '').toLowerCase();
    const subcatName = (product.subcategoryId?.name || '').toLowerCase();
    const tags = Array.isArray(product.tags) ? product.tags.join(' ').toLowerCase() : '';

    return terms.some(term => 
        prodName.includes(term) ||
        catName.includes(term) ||
        subcatName.includes(term) ||
        prodBrand.includes(term) ||
        prodDesc.includes(term) ||
        tags.includes(term)
    );
}
