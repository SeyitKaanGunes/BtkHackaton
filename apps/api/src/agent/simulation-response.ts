import type { ParsedAmount, ParsedCategory, ScenarioCard, WhatIfResponse } from "@fintwin/shared";

type SimulationAnswerInput = {
  simulation: WhatIfResponse;
  parsedAmount: ParsedAmount;
  parsedCategory: ParsedCategory;
};

export function composeSimulationAnswer({ simulation, parsedAmount, parsedCategory }: SimulationAnswerInput) {
  const amountLabel = formatMoney(parsedAmount.value ?? simulation.cards.find((card) => card.id === "risky")?.spendAmount ?? 0, parsedAmount.currency);
  const categoryLabel = simulation.resolvedCategoryName ?? categoryLabelFromParsed(parsedCategory) ?? "belirsiz kategori";
  const safe = requiredCard(simulation.cards, "safe");
  const balanced = requiredCard(simulation.cards, "balanced");
  const risky = requiredCard(simulation.cards, "risky");
  const assumptions = buildAssumptions(simulation, parsedAmount, parsedCategory);
  const confidence = simulation.dataConfidence ?? Math.min(parsedAmount.confidence, parsedCategory.confidence || 0.65);

  return [
    `${amountLabel} ${categoryLabel.toLocaleLowerCase("tr-TR")} harcaması için 3 senaryo çıkardım:`,
    "",
    "Daha temkinli senaryo:",
    `${formatMoney(safe.spendAmount, parsedAmount.currency)} seviyesinde kalırsan bütçeni daha az zorlarsın. Ay sonu tahmini bakiyen ${formatMoney(safe.monthEndBalance, parsedAmount.currency)} olur.`,
    "",
    "Dengeli senaryo:",
    `${formatMoney(balanced.spendAmount, parsedAmount.currency)} civarı harcama ay sonu bakiyeni korumaya çalışır ama kategori bütçende baskı yaratabilir. Tahmini bakiye ${formatMoney(balanced.monthEndBalance, parsedAmount.currency)}.`,
    "",
    "Riskli senaryo:",
    `${formatMoney(risky.spendAmount, parsedAmount.currency)} tam harcamada ay sonu tahmini bakiyen ${formatMoney(risky.monthEndBalance, parsedAmount.currency)} olur.`,
    emotionalDelayText(simulation),
    "",
    "Varsayımlar:",
    ...assumptions.map((assumption) => `- ${assumption}`),
    `- Veri güveni: ${simulation.dataConfidenceLevel ? confidenceLevelLabel(simulation.dataConfidenceLevel) : confidenceLabel(confidence)}.`
  ].join("\n");
}

function requiredCard(cards: ScenarioCard[], id: ScenarioCard["id"]) {
  const card = cards.find((item) => item.id === id);
  if (card) return card;
  return {
    id,
    label: id,
    spendAmount: 0,
    monthEndBalance: 0,
    debtImpact: 0,
    savingsImpactPercent: 0,
    recommendation: "Bu senaryo için yeterli veri yok."
  } satisfies ScenarioCard;
}

function buildAssumptions(simulation: WhatIfResponse, parsedAmount: ParsedAmount, parsedCategory: ParsedCategory) {
  const assumptions = simulation.assumptions.length ? [...simulation.assumptions] : ["Mevcut işlem ve bütçe verilerine göre hesaplandı."];
  if (parsedAmount.reason && parsedAmount.confidence < 0.9) assumptions.push(parsedAmount.reason);
  if (parsedCategory.category && parsedCategory.confidence >= 0.7) {
    assumptions.push(`Bunu ${categoryLabelFromParsed(parsedCategory)?.toLocaleLowerCase("tr-TR")} kategorisi olarak değerlendirdim.`);
  }
  if (!parsedCategory.category || parsedCategory.confidence < 0.7) {
    assumptions.push("Kategori güveni düşük olduğu için sonuç yaklaşık olabilir.");
  }
  if (simulation.missingData?.length) assumptions.push(`Eksik veri sinyali: ${simulation.missingData.join(", ")}.`);
  return [...new Set(assumptions)];
}

function emotionalDelayText(simulation: WhatIfResponse) {
  if (simulation.emotionalDelayMinutes > 0) {
    return `Kategori veya tutar riski nedeniyle ${simulation.emotionalDelayMinutes} dakika bekleme öneriyorum.`;
  }
  return "Bu tutar için ek bekleme sinyali düşük görünüyor; yine de fiyat karşılaştırması yapmanı öneririm.";
}

function confidenceLabel(value: number) {
  if (value >= 0.8) return `Yüksek (${Math.round(value * 100)}%)`;
  if (value >= 0.55) return `Orta (${Math.round(value * 100)}%)`;
  return `Düşük (${Math.round(value * 100)}%)`;
}

function confidenceLevelLabel(value: NonNullable<WhatIfResponse["dataConfidenceLevel"]>) {
  return { high: "Yüksek", medium: "Orta", low: "Düşük" }[value];
}

function categoryLabelFromParsed(parsedCategory: ParsedCategory) {
  if (!parsedCategory.category) return undefined;
  return {
    technology: "Teknoloji",
    market: "Market",
    food: "Yemek",
    transport: "Ulaşım",
    clothing: "Giyim",
    subscription: "Abonelik",
    rent_or_bills: "Kira/Fatura"
  }[parsedCategory.category];
}

function formatMoney(value: number, currency: ParsedAmount["currency"]) {
  const suffix = currency === "TRY" ? "TL" : currency;
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${suffix}`;
}
