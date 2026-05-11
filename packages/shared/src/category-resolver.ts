export type ParsedCategoryName = "technology" | "market" | "food" | "transport" | "clothing" | "subscription" | "rent_or_bills";

export type ParsedCategorySource = "direct_category" | "merchant_or_product" | "fallback" | "unknown";

export interface ParsedCategory {
  category?: ParsedCategoryName;
  categoryId?: string;
  confidence: number;
  matchedKeyword?: string;
  source: ParsedCategorySource;
}

type CategoryDictionaryEntry = {
  category: ParsedCategoryName;
  categoryId: string;
  directKeywords: string[];
  merchantOrProductKeywords: string[];
};

const DIRECT_CONFIDENCE = 0.94;
const MERCHANT_CONFIDENCE = 0.84;
const AMBIGUOUS_CONFIDENCE = 0.38;
const UNKNOWN_CONFIDENCE = 0.12;

const categoryDictionary: CategoryDictionaryEntry[] = [
  {
    category: "technology",
    categoryId: "cat-tech",
    directKeywords: ["teknoloji", "elektronik"],
    merchantOrProductKeywords: ["telefon", "iphone", "laptop", "bilgisayar", "tablet", "kulaklık", "playstation", "oyun konsolu"]
  },
  {
    category: "market",
    categoryId: "cat-market",
    directKeywords: ["market", "gıda", "alışveriş"],
    merchantOrProductKeywords: ["migros", "carrefour", "a101", "bim", "şok"]
  },
  {
    category: "food",
    categoryId: "cat-food",
    directKeywords: ["yemek", "restoran"],
    merchantOrProductKeywords: ["kahve", "starbucks", "yemeksepeti", "getir yemek", "burger", "pizza"]
  },
  {
    category: "transport",
    categoryId: "cat-transport",
    directKeywords: ["ulaşım", "akaryakıt"],
    merchantOrProductKeywords: ["uber", "taksi", "metro", "otobüs", "martı", "benzin"]
  },
  {
    category: "clothing",
    categoryId: "cat-clothes",
    directKeywords: ["giyim"],
    merchantOrProductKeywords: ["zara", "lc waikiki", "defacto", "ayakkabı", "mont", "pantolon"]
  },
  {
    category: "subscription",
    categoryId: "cat-subscription",
    directKeywords: ["abonelik"],
    merchantOrProductKeywords: ["netflix", "spotify", "youtube premium", "amazon prime", "disney", "exxen"]
  },
  {
    category: "rent_or_bills",
    categoryId: "cat-rent",
    directKeywords: ["kira", "aidat", "fatura"],
    merchantOrProductKeywords: ["elektrik", "su", "doğalgaz", "internet"]
  }
];

const ambiguousPatterns: Array<{ pattern: RegExp; keyword: string }> = [
  { pattern: /\bkahve\s+makinesi\b/iu, keyword: "kahve makinesi" }
];

export function resolveCategoryFromText(message: string): ParsedCategory {
  const normalized = normalizeText(message);
  if (!normalized) return unknownCategory();

  for (const ambiguous of ambiguousPatterns) {
    if (ambiguous.pattern.test(normalized)) {
      return {
        confidence: AMBIGUOUS_CONFIDENCE,
        matchedKeyword: ambiguous.keyword,
        source: "unknown"
      };
    }
  }

  for (const entry of categoryDictionary) {
    const matchedKeyword = findKeyword(normalized, entry.directKeywords);
    if (matchedKeyword) {
      return {
        category: entry.category,
        categoryId: entry.categoryId,
        confidence: DIRECT_CONFIDENCE,
        matchedKeyword,
        source: "direct_category"
      };
    }
  }

  for (const entry of categoryDictionary) {
    const matchedKeyword = findKeyword(normalized, entry.merchantOrProductKeywords);
    if (matchedKeyword) {
      return {
        category: entry.category,
        categoryId: entry.categoryId,
        confidence: MERCHANT_CONFIDENCE,
        matchedKeyword,
        source: "merchant_or_product"
      };
    }
  }

  return unknownCategory();
}

export function categoryIdForParsedCategory(category?: ParsedCategoryName) {
  return categoryDictionary.find((entry) => entry.category === category)?.categoryId;
}

function normalizeText(text: string) {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/\u00a0/g, " ")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function findKeyword(text: string, keywords: string[]) {
  return keywords.find((keyword) => keywordMatches(text, keyword));
}

function keywordMatches(text: string, keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function unknownCategory(): ParsedCategory {
  return {
    confidence: UNKNOWN_CONFIDENCE,
    source: "unknown"
  };
}
