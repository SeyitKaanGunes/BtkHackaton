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
    const parsedDate = new Date(`${occurredAt}T12:00:00.000Z`);
    if (!ISO_DATE_PATTERN.test(occurredAt) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== occurredAt) {
      warnings.push(`Item #${itemNumber} atıldı: occurredAt geçersiz`);
      return;
    }

    const categoryName = typeof record.categoryName === "string" ? record.categoryName.trim() : "";
    if (!categoryName) {
      warnings.push(`Item #${itemNumber} atıldı: categoryName boş`);
      return;
    }

    const paymentMethod = typeof record.paymentMethod === "string" && PAYMENT_METHODS.has(record.paymentMethod) ? (record.paymentMethod as StatementLineItem["paymentMethod"]) : undefined;
    if (!paymentMethod) {
      warnings.push(`Item #${itemNumber} atıldı: paymentMethod geçersiz`);
      return;
    }

    const confidence = Number(record.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      warnings.push(`Item #${itemNumber} atıldı: confidence geçersiz`);
      return;
    }

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
