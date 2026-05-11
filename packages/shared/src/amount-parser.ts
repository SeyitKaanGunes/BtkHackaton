import type { Currency } from "./types.js";

export interface ParsedAmount {
  value?: number;
  currency: Currency;
  confidence: number;
  rawText?: string;
  reason?: string;
}

type AmountCandidate = Required<Pick<ParsedAmount, "value" | "currency" | "confidence" | "rawText" | "reason">> & {
  index: number;
};

const DEFAULT_CURRENCY: Currency = "TRY";
const HIGH_CONFIDENCE = 0.96;
const WORD_CONFIDENCE = 0.98;
const SHORT_AMOUNT_CONFIDENCE = 0.76;
const PLAIN_AMOUNT_CONFIDENCE = 0.58;
const LOW_CONFIDENCE = 0.15;

const monthNames = [
  "ocak",
  "şubat",
  "subat",
  "mart",
  "nisan",
  "mayıs",
  "mayis",
  "haziran",
  "temmuz",
  "ağustos",
  "agustos",
  "eylül",
  "eylul",
  "ekim",
  "kasım",
  "kasim",
  "aralık",
  "aralik"
];

export function parseAmountFromText(message: string, defaultCurrency: Currency = DEFAULT_CURRENCY): ParsedAmount {
  const text = message.trim();
  if (!text) {
    return { currency: defaultCurrency, confidence: LOW_CONFIDENCE, reason: "Mesajda tutar bulunamadı." };
  }

  const normalized = normalizeText(text);
  const candidates = [
    ...currencyAmountCandidates(normalized),
    ...wordAmountCandidates(normalized, defaultCurrency),
    ...compactAmountCandidates(normalized, defaultCurrency),
    ...plainAmountCandidates(normalized, defaultCurrency)
  ].filter((candidate) => Number.isFinite(candidate.value) && candidate.value > 0);

  const best = candidates
    .filter((candidate) => !isProbablyNonAmount(normalized, candidate))
    .sort((left, right) => right.confidence - left.confidence || right.value - left.value)[0];

  if (!best) {
    return {
      currency: defaultCurrency,
      confidence: LOW_CONFIDENCE,
      reason: "Tarih, model veya taksit sayısı dışında güvenilir bir tutar bulunamadı."
    };
  }

  return {
    value: roundAmount(best.value),
    currency: best.currency,
    confidence: best.confidence,
    rawText: best.rawText.trim(),
    reason: best.reason
  };
}

function normalizeText(text: string) {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/\u00a0/g, " ")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function currencyAmountCandidates(text: string): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  const numberPattern = "\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|\\d+(?:,\\d+)?";
  const patterns: Array<{ regex: RegExp; currency: Currency; symbol: boolean }> = [
    { regex: new RegExp(`(?:₺\\s*)(${numberPattern})|(${numberPattern})\\s*(?:tl|try|₺)`, "giu"), currency: "TRY", symbol: true },
    { regex: new RegExp(`(?:\\$\\s*)(${numberPattern})|(${numberPattern})\\s*(?:usd|dolar)`, "giu"), currency: "USD", symbol: true },
    { regex: new RegExp(`(?:€\\s*)(${numberPattern})|(${numberPattern})\\s*(?:eur|euro|avro)`, "giu"), currency: "EUR", symbol: true }
  ];

  for (const { regex, currency } of patterns) {
    for (const match of text.matchAll(regex)) {
      const rawNumber = match[1] ?? match[2];
      const value = parseLocalizedNumber(rawNumber);
      if (value === undefined) continue;
      candidates.push({
        value,
        currency,
        confidence: HIGH_CONFIDENCE,
        rawText: match[0],
        reason: "Para birimi belirtildiği için tutar yüksek güvenle ayrıştırıldı.",
        index: match.index ?? 0
      });
    }
  }

  return candidates;
}

function wordAmountCandidates(text: string, defaultCurrency: Currency): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  const regex = /(\d+(?:[.,]\d+)?)\s*bin(?:\s+(\d{1,3}(?:[.,]\d+)?))?(?:\s*(tl|try|₺|usd|dolar|eur|euro|avro))?/giu;

  for (const match of text.matchAll(regex)) {
    const thousands = parseLocalizedNumber(match[1]);
    if (thousands === undefined) continue;
    const rest = match[2] ? parseLocalizedNumber(match[2]) ?? 0 : 0;
    const currency = currencyFromToken(match[3]) ?? defaultCurrency;
    const hasCurrency = Boolean(match[3]);
    candidates.push({
      value: thousands * 1000 + rest,
      currency,
      confidence: hasCurrency ? WORD_CONFIDENCE : SHORT_AMOUNT_CONFIDENCE,
      rawText: match[0],
      reason: hasCurrency ? "\"bin\" ifadesi ve para birimi birlikte yakalandı." : "Para birimi yazılmadığı için TRY varsayıldı.",
      index: match.index ?? 0
    });
  }

  return candidates;
}

function compactAmountCandidates(text: string, defaultCurrency: Currency): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  const regex = /(\d+(?:[.,]\d+)?)\s*k(?:\b|(?=\s))/giu;

  for (const match of text.matchAll(regex)) {
    const value = parseLocalizedNumber(match[1]);
    if (value === undefined) continue;
    candidates.push({
      value: value * 1000,
      currency: defaultCurrency,
      confidence: SHORT_AMOUNT_CONFIDENCE,
      rawText: match[0],
      reason: "\"k\" kısa tutar ifadesi olarak yorumlandı; para birimi yazılmadığı için TRY varsayıldı.",
      index: match.index ?? 0
    });
  }

  return candidates;
}

function plainAmountCandidates(text: string, defaultCurrency: Currency): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  const regex = /\b(\d{3,}(?:[.,]\d+)?)\b/giu;

  for (const match of text.matchAll(regex)) {
    const raw = match[1];
    const value = parseLocalizedNumber(raw);
    if (value === undefined) continue;
    candidates.push({
      value,
      currency: defaultCurrency,
      confidence: PLAIN_AMOUNT_CONFIDENCE,
      rawText: raw,
      reason: "Para birimi yazılmadığı için TRY varsayıldı.",
      index: match.index ?? 0
    });
  }

  return candidates;
}

function parseLocalizedNumber(raw: string | undefined) {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let normalized = trimmed;
  if (trimmed.includes(",")) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, "");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

function currencyFromToken(token?: string): Currency | undefined {
  if (!token) return undefined;
  const normalized = token.toLocaleLowerCase("tr-TR");
  if (["tl", "try", "₺"].includes(normalized)) return "TRY";
  if (["usd", "dolar"].includes(normalized)) return "USD";
  if (["eur", "euro", "avro"].includes(normalized)) return "EUR";
  return undefined;
}

function isProbablyNonAmount(text: string, candidate: AmountCandidate) {
  const before = text.slice(Math.max(0, candidate.index - 18), candidate.index);
  const after = text.slice(candidate.index + candidate.rawText.length, candidate.index + candidate.rawText.length + 24);
  const neighborhood = `${before} ${candidate.rawText} ${after}`;

  if (candidate.confidence >= WORD_CONFIDENCE) return false;
  if (monthNames.some((month) => new RegExp(`\\b${month}\\b`, "iu").test(after))) return true;
  if (/\b(model|iphone|galaxy|seri|nesil)\b/iu.test(after) && candidate.value < 3000) return true;
  if (/\b(model|yılı|yilı|yili|senesi)\b/iu.test(after) && candidate.value >= 1900 && candidate.value <= 2100) return true;
  if (/\btaksit\b/iu.test(after) && candidate.value < 100) return true;
  if (/\btaksit\b/iu.test(neighborhood) && candidate.value < 100) return true;
  return false;
}

function roundAmount(value: number) {
  return Math.round(value * 100) / 100;
}
