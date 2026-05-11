export type DataConfidence = "low" | "medium" | "high";

export interface FinancialDataAvailability {
  hasBalance?: boolean;
  hasTransactions?: boolean;
  hasBudgets?: boolean;
  hasIncome?: boolean;
  hasFixedExpenses?: boolean;
  hasDebtPayments?: boolean;
  hasPlannedSavings?: boolean;
  hasEmergencyBuffer?: boolean;
}

export interface FinancialResultMetadata {
  dataConfidence: DataConfidence;
  assumptions: string[];
  missingData: string[];
}

type AvailabilityKey = keyof FinancialDataAvailability;

const missingDataKeys: Array<{ key: AvailabilityKey; label: string }> = [
  { key: "hasBalance", label: "balance" },
  { key: "hasTransactions", label: "transactions" },
  { key: "hasBudgets", label: "budgets" },
  { key: "hasIncome", label: "income" },
  { key: "hasFixedExpenses", label: "fixedExpenses" },
  { key: "hasDebtPayments", label: "debtPayments" },
  { key: "hasPlannedSavings", label: "plannedSavings" },
  { key: "hasEmergencyBuffer", label: "emergencyBuffer" }
];

const assumptionByMissingKey: Record<AvailabilityKey, string> = {
  hasBalance: "Bakiye verisi bulunmadığı için nakit etkisi düşük güvenle yorumlandı.",
  hasTransactions: "İşlem geçmişi bulunmadığı için davranışsal desen varsayılmadı.",
  hasBudgets: "Bu kategori için bütçe tanımlı değil.",
  hasIncome: "Gelir verisi bulunmadığı için gelir oranlı metrikler düşük güvenle yorumlandı.",
  hasFixedExpenses: "Yaklaşan sabit gider verisi bulunmadığı için hesaba katılmadı.",
  hasDebtPayments: "Borç ödeme verisi bulunmadığı için borç etkisi ayrıca modellenmedi.",
  hasPlannedSavings: "Planlı birikim verisi bulunmadığı için tasarruf etkisi yaklaşık tutuldu.",
  hasEmergencyBuffer: "Acil durum tamponu verisi bulunmadığı için buffer etkisi hesaba katılmadı."
};

const completeDataAssumption = "Mevcut bakiye, işlem, gelir, bütçe ve sabit gider verileriyle hesaplandı.";

export function calculateDataConfidence(input: FinancialDataAvailability): DataConfidence {
  if (input.hasBalance && input.hasTransactions && input.hasBudgets && input.hasIncome && input.hasFixedExpenses) {
    return "high";
  }

  if (input.hasTransactions && (input.hasBalance || input.hasIncome)) {
    return "medium";
  }

  return "low";
}

export function buildFinancialMetadata(input: FinancialDataAvailability): FinancialResultMetadata {
  const missingData = missingDataKeys.filter(({ key }) => input[key] !== true).map(({ label }) => label);
  const missingAssumptions = missingDataKeys
    .filter(({ key }) => input[key] !== true)
    .map(({ key }) => assumptionByMissingKey[key]);

  return {
    dataConfidence: calculateDataConfidence(input),
    assumptions: missingAssumptions.length ? missingAssumptions : [completeDataAssumption],
    missingData
  };
}
