import type { StatementLineItem } from "@fintwin/shared";

const PAYMENT_METHODS = new Set(["cash", "debit_card", "credit_card", "transfer"]);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateItems(items: unknown[]): { valid: StatementLineItem[]; warnings: string[] } {
  const valid: StatementLineItem[] = [];
  const warnings: string[] = [];

  items.forEach((item, index) => {
    const itemNumber = index + 1;
    if (!item || typeof item !== "object") {
      warnings.push(`Item #${itemNumber} atıldı: obje değil`);
      return;
    }

    const record = item as Record<string, unknown>;
    const merchant = typeof record.merchant === "string" ? record.merchant.trim() : "";
    if (merchant.length < 2) {
      warnings.push(`Item #${itemNumber} atıldı: merchant boş`);
      return;
    }

    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      warnings.push(`Item #${itemNumber} atıldı: amount geçersiz`);
      return;
    }

    const occurredAt = typeof record.occurredAt === "string" ? record.occurredAt.trim() : "";
    if (!ISO_DATE_PATTERN.test(occurredAt) || Number.isNaN(new Date(`${occurredAt}T00:00:00.000Z`).getTime())) {
      warnings.push(`Item #${itemNumber} atıldı: occurredAt geçersiz`);
      return;
    }

    const categoryName = typeof record.categoryName === "string" && record.categoryName.trim() ? record.categoryName.trim() : "Diğer";
    const paymentMethod = normalizePaymentMethod(record.paymentMethod);
    const confidence = clamp(Number(record.confidence));

    valid.push({
      merchant,
      amount,
      occurredAt,
      categoryName,
      paymentMethod,
      confidence
    });
  });

  return { valid, warnings };
}

function normalizePaymentMethod(value: unknown): StatementLineItem["paymentMethod"] {
  return typeof value === "string" && PAYMENT_METHODS.has(value) ? (value as StatementLineItem["paymentMethod"]) : "credit_card";
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
