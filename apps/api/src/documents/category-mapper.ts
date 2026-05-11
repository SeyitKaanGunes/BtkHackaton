import type { Category } from "@fintwin/shared";

const categoryHints: Array<{ categoryId: string; terms: string[] }> = [
  { categoryId: "cat-tech", terms: ["teknoloji", "elektronik", "telefon", "bilgisayar", "software", "yazılım", "tekno"] },
  { categoryId: "cat-clothes", terms: ["giyim", "moda", "kıyafet", "ayakkabı", "tekstil"] },
  { categoryId: "cat-market", terms: ["market", "bakkal", "gıda", "süpermarket", "temel"] },
  { categoryId: "cat-food", terms: ["yemek", "restoran", "cafe", "kahve", "burger", "lokanta"] },
  { categoryId: "cat-transport", terms: ["ulaşım", "taksi", "metro", "otobüs", "akaryakıt", "benzin", "yakıt"] },
  { categoryId: "cat-subscription", terms: ["abonelik", "subscription", "stream", "cloud", "üyelik", "netflix", "spotify"] },
  { categoryId: "cat-rent", terms: ["kira", "aidat"] }
];

export function mapCategoryNameToId(categoryName: string, merchant: string, categories: Category[]) {
  const haystack = normalize(`${categoryName} ${merchant}`);
  const direct = categories.find((category) => normalize(category.name) === normalize(categoryName) && category.kind === "expense");
  if (direct) return direct.id;

  const matched = categoryHints.find((hint) => hint.terms.some((term) => haystack.includes(normalize(term))));
  if (matched && categories.some((category) => category.id === matched.categoryId)) return matched.categoryId;

  const otherCategory = categories.find((category) => category.id === "cat-other" && category.kind === "expense");
  if (otherCategory) return otherCategory.id;

  throw new Error("cat-other expense category is required for uncategorized document imports.");
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
