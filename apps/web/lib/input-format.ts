export function parseMoneyInput(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const normalized = normalizeMoneyInput(raw);
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function normalizeMoneyInput(raw: string) {
  const compact = raw.replace(/\s/g, "");
  if (!/^\d+(?:[.,]\d+)*$/.test(compact)) return undefined;
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const separators = [...compact].filter((char) => char === "," || char === ".").length;
  if (separators === 0) return compact;

  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const otherSeparator = decimalSeparator === "," ? "." : ",";
  if (compact.includes(decimalSeparator) && compact.includes(otherSeparator)) {
    const [whole, fraction] = splitLast(compact, decimalSeparator);
    if (!/^\d{1,3}(?:[.,]\d{3})*$/.test(whole) || !/^\d{1,2}$/.test(fraction)) return undefined;
    return `${whole.replace(/[.,]/g, "")}.${fraction}`;
  }

  const parts = compact.split(decimalSeparator);
  if (parts.length === 2) {
    const [whole, fraction] = parts;
    if (!whole || !fraction) return undefined;
    if (fraction.length <= 2) return `${whole}.${fraction}`;
    if (fraction.length === 3 && whole.length <= 3) return `${whole}${fraction}`;
    return undefined;
  }

  if (!/^\d{1,3}(?:[.,]\d{3})+$/.test(compact)) return undefined;
  return compact.replace(/[.,]/g, "");
}

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function splitLast(value: string, separator: string): [string, string] {
  const index = value.lastIndexOf(separator);
  return [value.slice(0, index), value.slice(index + 1)];
}
