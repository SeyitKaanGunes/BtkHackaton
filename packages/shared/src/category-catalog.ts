import type { Category } from "./types.js";

export const categories: Category[] = [
  { id: "cat-salary", name: "Maaş", kind: "income", color: "#16a34a" },
  { id: "cat-other-income", name: "Diğer gelir", kind: "income", color: "#0d9488" },
  { id: "cat-tech", name: "Teknoloji", kind: "expense", color: "#4f46e5" },
  { id: "cat-clothes", name: "Giyim", kind: "expense", color: "#db2777" },
  { id: "cat-market", name: "Market", kind: "expense", color: "#f59e0b" },
  { id: "cat-food", name: "Yemek", kind: "expense", color: "#ef4444" },
  { id: "cat-transport", name: "Ulaşım", kind: "expense", color: "#0891b2" },
  { id: "cat-subscription", name: "Abonelik", kind: "expense", color: "#7c3aed" },
  { id: "cat-rent", name: "Kira", kind: "expense", color: "#64748b" },
  { id: "cat-other", name: "Diğer", kind: "expense", color: "#71717a" }
];
