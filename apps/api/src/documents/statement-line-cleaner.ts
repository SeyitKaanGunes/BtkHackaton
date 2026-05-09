const DATE_PATTERN = /\b\d{2}[/.]\d{2}[/.]\d{4}\b/;
const AMOUNT_PATTERN = /(?:-?\d+(?:[.,]\d{3})*[.,]\d{2}\b|\b-?\d+[.,]\d{2}\s*(?:TL|₺)\b|\b-?\d+\s*(?:TL|₺)\b)/i;
const DROP_KEYWORDS_PATTERN =
  /dönem borcu|asgari ödeme|son ödeme|kart no|kart numarası|kullanılabilir limit|limit|gecikme faizi|faiz|[iİ]ade|ödeme alındı|bakiye devri|ekstre tarihi|hesap özeti|sayfa\s+\d+|müşteri no|iban|swift/i;
const ONLY_NUMBER_OR_PUNCTUATION_PATTERN = /^[\d\s.,:;+\-_/\\()[\]{}%₺]+$/;

export function cleanStatementText(rawText: string): { candidateLines: string[]; droppedCount: number } {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const candidateLines: string[] = [];
  let droppedCount = 0;

  for (const line of lines) {
    if (shouldDropLine(line)) {
      droppedCount += 1;
      continue;
    }
    candidateLines.push(line);
  }

  return { candidateLines, droppedCount };
}

function shouldDropLine(line: string): boolean {
  if (line.length < 6) return true;
  if (ONLY_NUMBER_OR_PUNCTUATION_PATTERN.test(line)) return true;
  if (DROP_KEYWORDS_PATTERN.test(line)) return true;

  const hasDate = DATE_PATTERN.test(line);
  const hasAmount = AMOUNT_PATTERN.test(line);
  return !hasDate && !hasAmount;
}
