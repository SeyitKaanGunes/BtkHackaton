const DATE_PATTERN = /\b(?:\d{2}[/.]\d{2}[/.]\d{4}|\d{4}-\d{2}-\d{2})\b/;
const AMOUNT_PATTERN = /(?:-?\d+(?:[.,]\d{3})*[.,]\d{2}\b|\b-?\d+[.,]\d{2}\s*(?:TL|₺)\b|\b-?\d+\s*(?:TL|₺)\b)/i;
const AMOUNT_CAPTURE_PATTERN = /-?\d+(?:[.\s]\d{3})*(?:,\d{2})|-?\d+(?:\.\d{2})|-?\d+\s*(?=TL|₺)/gi;
const DROP_KEYWORDS_PATTERN =
  /dönem borcu|asgari ödeme|son ödeme|kart no|kart numarası|kullanılabilir limit|limit|gecikme faizi|faiz|[iİ]ade|ödeme alındı|bakiye devri|ekstre tarihi|hesap özeti|sayfa\s+\d+|müşteri no|iban|swift/i;
const ONLY_NUMBER_OR_PUNCTUATION_PATTERN = /^[\d\s.,:;+\-_/\\()[\]{}%₺]+$/;
const SUMMARY_TOTAL_PATTERN =
  /toplam\s+(?:harcama|alışveriş|alisveris|işlem|islem)|(?:harcama|alışveriş|alisveris|işlem|islem)\s+toplam[ıi]|dönem\s+içi\s+harcama|donem\s+ici\s+harcama|ekstre\s+toplam[ıi]/i;
const SUMMARY_TOTAL_EXCLUSION_PATTERN =
  /asgari|minimum|son\s+ödeme|son\s+odeme|ödeme\s+tarihi|odeme\s+tarihi|limit|faiz|iade|bakiye\s+devri|kart\s+ödemesi|kart\s+odemesi|ödenen|odenen/i;

export interface StatementTextAnalysis {
  candidateLines: string[];
  droppedCount: number;
  dateAmountLineCount: number;
  expectedTotalAmount?: number;
}

export function cleanStatementText(rawText: string): StatementTextAnalysis {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const candidateLines: string[] = [];
  let droppedCount = 0;
  let dateAmountLineCount = 0;

  for (const line of lines) {
    if (shouldDropLine(line)) {
      droppedCount += 1;
      continue;
    }
    candidateLines.push(line);
    if (DATE_PATTERN.test(line) && AMOUNT_PATTERN.test(line)) {
      dateAmountLineCount += 1;
    }
  }

  return {
    candidateLines,
    droppedCount,
    dateAmountLineCount,
    expectedTotalAmount: detectExpectedTotalAmount(lines)
  };
}

function shouldDropLine(line: string): boolean {
  if (line.length < 6) return true;
  if (ONLY_NUMBER_OR_PUNCTUATION_PATTERN.test(line)) return true;
  if (SUMMARY_TOTAL_PATTERN.test(line)) return true;
  if (DROP_KEYWORDS_PATTERN.test(line)) return true;

  const hasDate = DATE_PATTERN.test(line);
  const hasAmount = AMOUNT_PATTERN.test(line);
  return !hasDate && !hasAmount;
}

function detectExpectedTotalAmount(lines: string[]): number | undefined {
  for (const line of lines) {
    if (!SUMMARY_TOTAL_PATTERN.test(line) || SUMMARY_TOTAL_EXCLUSION_PATTERN.test(line)) continue;
    const amounts = [...line.matchAll(AMOUNT_CAPTURE_PATTERN)].map((match) => parseAmount(match[0])).filter(isFinitePositive);
    const amount = amounts.at(-1);
    if (amount !== undefined) return amount;
  }
  return undefined;
}

function parseAmount(value: string): number {
  const numeric = value.replace(/[^\d,.-]/g, "");
  if (!numeric) return Number.NaN;
  const hasComma = numeric.includes(",");
  const hasDot = numeric.includes(".");
  let normalized = numeric;

  if (hasComma && hasDot) {
    normalized = numeric.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = numeric.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = numeric.split(".");
    normalized = parts.length > 2 || /^\d{1,3}\.\d{3}$/.test(numeric) ? numeric.replace(/\./g, "") : numeric;
  }

  return Number(normalized);
}

function isFinitePositive(value: number): value is number {
  return Number.isFinite(value) && value > 0;
}
