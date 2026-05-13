import type { StatementPreviewItem } from "@fintwin/shared";

export interface StatementConsistencyInput {
  items: StatementPreviewItem[];
  avgConfidence: number;
  statementMonth: string;
  candidateLineCount?: number;
  expectedTotalAmount?: number;
}

export function analyzeConsistency(input: StatementConsistencyInput): { warnings: string[]; lowConfidenceCount: number; sumMismatch: boolean } {
  const { items, avgConfidence, statementMonth, candidateLineCount, expectedTotalAmount } = input;
  const warnings: string[] = [];
  const lowConfidenceCount = items.filter((item) => item.confidence < 0.6).length;
  const itemTotal = Number(items.reduce((total, item) => total + item.amount, 0).toFixed(2));
  let sumMismatch = false;

  if (lowConfidenceCount > 0) {
    warnings.push(`${lowConfidenceCount} kalemde güven skoru düşük.`);
  }
  if (candidateLineCount !== undefined && candidateLineCount >= 5) {
    const missingCandidateCount = candidateLineCount - items.length;
    const extractionRatio = candidateLineCount === 0 ? 1 : items.length / candidateLineCount;
    if (missingCandidateCount >= 2 && extractionRatio < 0.75) {
      warnings.push(`${candidateLineCount} aday satırdan ${items.length} kalem çıkarıldı, eksik ayrıştırma olabilir.`);
    }
  }
  if (avgConfidence < 0.6) {
    warnings.push(`Ortalama güven skoru düşük (${Math.round(avgConfidence * 100)}%).`);
  }

  const outOfMonthCount = items.filter((item) => item.occurredAt.slice(0, 7) !== statementMonth).length;
  if (outOfMonthCount > 0) {
    warnings.push(`${outOfMonthCount} kalemin tarihi ${statementMonth} dönemi dışında.`);
  }

  if (expectedTotalAmount !== undefined) {
    const difference = Math.abs(itemTotal - expectedTotalAmount);
    const tolerance = Math.max(1, expectedTotalAmount * 0.01);
    if (difference > tolerance) {
      sumMismatch = true;
      warnings.push(
        `Ekstre toplamı (${formatTry(expectedTotalAmount)}) ile çıkarılan kalem toplamı (${formatTry(itemTotal)}) uyuşmuyor.`
      );
    }
  }

  return { warnings, lowConfidenceCount, sumMismatch };
}

function formatTry(value: number): string {
  return `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}
