import type { StatementLineItem, StatementPreviewItem, Transaction } from "@fintwin/shared";

export function markDuplicates(items: StatementLineItem[], userId: string, transactions: Transaction[]): StatementPreviewItem[] {
  return items.map((item, index) => {
    const existing = transactions.find((transaction) => isSameTransaction(item, userId, transaction));
    return {
      ...item,
      index,
      existingTransactionId: existing?.id
    };
  });
}

function isSameTransaction(item: StatementLineItem, userId: string, transaction: Transaction): boolean {
  return (
    transaction.userId === userId &&
    transaction.merchant.toLocaleLowerCase("tr-TR") === item.merchant.toLocaleLowerCase("tr-TR") &&
    Math.abs(Number(transaction.amount) - item.amount) < 0.01 &&
    transaction.occurredAt.slice(0, 10) === item.occurredAt
  );
}
