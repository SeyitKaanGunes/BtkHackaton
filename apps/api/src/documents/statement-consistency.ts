import type { StatementPreviewItem } from "@fintwin/shared";

export function analyzeConsistency(
  items: StatementPreviewItem[],
  avgConfidence: number,
  statementMonth: string
): { warnings: string[]; lowConfidenceCount: number; sumMismatch: boolean } {
  const warnings: string[] = [];
  const lowConfidenceCount = items.filter((item) => item.confidence < 0.6).length;

  if (lowConfidenceCount > 0) {
    warnings.push(`${lowConfidenceCount} kalemde güven skoru düşük.`);
  }
  if (items.length < 5) {
    warnings.push(`Sadece ${items.length} kalem çıktı, eksik ayrıştırma olabilir.`);
  }
  if (avgConfidence < 0.6) {
    warnings.push(`Ortalama güven skoru düşük (${Math.round(avgConfidence * 100)}%).`);
  }

  void statementMonth;
  return { warnings, lowConfidenceCount, sumMismatch: false };
}
