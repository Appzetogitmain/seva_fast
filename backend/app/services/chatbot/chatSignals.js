// Deterministic per-message signals. These run on every user message so the admin
// analytics do not depend on the (cadenced, fallible) LLM classification pass.

export const CHAT_TOPICS = ["subscription", "services"];

// Matched as whole words after lower-casing, so "class" or "assistant" never trip it.
const ABUSIVE_WORDS = new Set([
  // English
  "fuck", "fucker", "fucking", "fucked", "fuk", "fck", "motherfucker", "mofo", "shit", "bullshit",
  "bitch", "bastard", "asshole", "arsehole", "dick", "dickhead", "pussy", "cunt", "slut", "whore",
  "prick", "wanker", "retard", "moron", "idiot", "stupid", "scumbag", "stfu",
  // Hindi / Hinglish (common romanised spellings)
  "chutiya", "chutiye", "chutia", "chutya", "chut", "madarchod", "madarchot", "maderchod", "madarchood",
  "behenchod", "bhenchod", "behnchod", "bhenchot", "bahenchod", "bhosdike", "bhosdiwale", "bhosadike",
  "bhosdi", "bhosda", "gandu", "gaandu", "gand", "gaand", "lund", "lauda", "lavda", "lawda", "loda",
  "lodu", "randi", "rand", "harami", "haramzada", "haramzade", "haramkhor", "kamina", "kamine", "kamini",
  "kutta", "kutte", "kutiya", "kuttiya", "saala", "saale", "sala", "sale", "saali", "suar", "suwar",
  "tatti", "jhaat", "jhatu", "jhantu", "chodu", "betichod", "bkl", "mkc", "bsdk", "mc", "bc",
]);

// "sale" / "sala" are everyday shopping words, "bc"/"mc" are common abbreviations —
// only count them when another abusive word is present in the same message.
// Likewise "chut" (discount) and "kutta" (dog, e.g. dog food) have innocent meanings.
const WEAK_ABUSIVE_WORDS = new Set([
  "sale", "sala", "bc", "mc", "rand", "gand", "dick", "chut", "kutta", "kutte",
]);
const WEAK_ABUSIVE_DEVANAGARI = new Set(["कुत्ता", "कुत्ते", "साला", "साले", "साली"]);

// Devanagari has no usable word boundary with combining marks, so match as substrings.
const ABUSIVE_DEVANAGARI = [
  "चूतिया", "चुतिया", "चूतिये", "चुतिये", "मादरचोद", "बहनचोद", "भेनचोद", "भोसड़ी", "भोसडी", "भोसड़ीके",
  "गांडू", "गाँडू", "गांड", "गाँड", "लंड", "लौड़ा", "लौडा", "रंडी", "हरामी", "हरामज़ादा", "हरामजादा",
  "हरामखोर", "कमीना", "कमीने", "कमीनी", "कुत्ता", "कुत्ते", "कुतिया", "साला", "साले", "साली", "सुअर", "टट्टी",
];

const TOPIC_PATTERNS = {
  subscription:
    /\b(subscriptions?|subscribe[ds]?|subscribing|membership|memberships|plans?|premium|renew(al)?)\b|सब्सक्रिप्शन|सब्स्क्रिप्शन|सदस्यता|मेंबरशिप|मेम्बरशिप|प्लान/i,
  services:
    /\b(services?|servicing|plumbers?|electricians?|carpenters?|technicians?|mechanics?|painters?|cleaning|cleaner|repair(s|ing)?|salon|beautician|pest control|professionals?|book(ing)? (a|an)?\s?(service|appointment))\b|सर्विस|सर्विसेज|प्लंबर|इलेक्ट्रीशियन|मिस्त्री|कारीगर|मरम्मत|सफाई/i,
};

/**
 * @returns {string[]} the abusive words found in the text (empty when clean).
 */
export function detectAbusiveWords(text = "") {
  const raw = String(text || "");
  if (!raw.trim()) return [];

  const tokens = raw.toLowerCase().split(/[^\p{L}\p{M}]+/u).filter(Boolean);
  const hits = tokens.filter((t) => ABUSIVE_WORDS.has(t));
  const devanagariHits = ABUSIVE_DEVANAGARI.filter((w) => raw.includes(w));

  const strong = hits.filter((t) => !WEAK_ABUSIVE_WORDS.has(t));
  const strongDevanagari = devanagariHits.filter((w) => !WEAK_ABUSIVE_DEVANAGARI.has(w));
  if (strong.length === 0 && strongDevanagari.length === 0) return [];

  return [...new Set([...hits, ...devanagariHits])];
}

/**
 * @returns {string[]} subset of CHAT_TOPICS the text is asking about.
 */
export function detectTopics(text = "") {
  const raw = String(text || "");
  if (!raw.trim()) return [];
  return CHAT_TOPICS.filter((topic) => TOPIC_PATTERNS[topic].test(raw));
}
