import { AppShell } from "../components/app-shell";
import { DashboardOverview, type AssetSegment, type DashboardSection, type LedgerRow } from "../components/dashboard-overview";
import { getInvestmentPortfolio, getPersonalDashboard, getSubscriptionLeaks, getWhatIf } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboard, leaks, whatIf, investmentPortfolio] = await Promise.all([
    getPersonalDashboard(),
    getSubscriptionLeaks(),
    getWhatIf(),
    getInvestmentPortfolio()
  ]);

  const netBalance = dashboard.income - dashboard.expenses;
  const leakImpact = leaks.reduce((total, leak) => total + leak.monthlyImpact, 0);
  const expenseRows: LedgerRow[] = dashboard.categoryBreakdown.map((item) => ({
    label: item.name,
    value: formatTry(item.value),
    meta: "Mayıs kategori harcaması",
    detail: `Toplam gider içindeki payı ${formatPercent((item.value / dashboard.expenses) * 100)}.`
  }));
  const topExpenses = expenseRows.slice(0, 3);
  const riskyScenario = whatIf.cards.find((card) => card.id === "risky") ?? whatIf.cards[whatIf.cards.length - 1];
  const biggestExpense = dashboard.categoryBreakdown[0];

  const incomeRows: LedgerRow[] = [
    { label: "Aylık gelir", value: formatTry(dashboard.income), meta: "Tanımlı ana nakit akışı" },
    { label: "Portföy değeri", value: formatTry(investmentPortfolio.totalMarketValueTry), meta: "Yatırım toplamı" },
    { label: "Günlük faiz", value: formatTry(investmentPortfolio.totalDailyInterestTry), meta: "Mevduat projeksiyonu" },
    { label: "Gün sonu portföy", value: formatTry(investmentPortfolio.projectedEndOfDayValueTry), meta: "Faiz sonrası tahmini değer" },
    { label: "Net bakiye", value: formatTry(netBalance), meta: "Gelirden aylık gider düşüldü" },
    { label: "Birikim oranı", value: formatPercent(dashboard.savingsRate), meta: "Aylık gelir içindeki kalan pay" },
    { label: "Hesap bakiyesi", value: formatTry(dashboard.balance), meta: "Tüm demo hesapların net bakiyesi" }
  ];

  const potentialRows: LedgerRow[] = [
    {
      label: biggestExpense ? `${biggestExpense.name} kontrolü` : "Kategori kontrolü",
      value: biggestExpense ? formatTry(biggestExpense.value) : formatTry(whatIf.safeLimit),
      meta: "Gelire bağlanmayan yüksek harcama"
    },
    { label: "Abonelik sızıntısı", value: formatTry(leakImpact), meta: `${leaks.length} bulgu açık` },
    { label: "Riskli senaryo", value: formatTry(riskyScenario?.spendAmount ?? whatIf.safeLimit), meta: `${whatIf.emotionalDelayMinutes || 10} dk bekleme önerisi` }
  ];

  const detailedPotentialRows: LedgerRow[] = [
    ...potentialRows,
    ...leaks.map((leak) => ({
      label: leak.merchant,
      value: formatTry(leak.monthlyImpact),
      meta: leakIssueLabel(leak.issue),
      detail: leak.recommendation
    })),
    ...whatIf.cards.map((card) => ({
      label: card.label,
      value: formatTry(card.spendAmount),
      meta: `Ay sonu bakiye ${formatTry(card.monthEndBalance)}`,
      detail: card.recommendation
    })),
    ...dashboard.upcomingActions.map((action) => ({
      label: action.title,
      value: actionStatusLabel(action.status),
      meta: action.dueAt ? formatDate(action.dueAt) : "Plan bekliyor",
      detail: action.description
    })),
    ...dashboard.riskAlerts.map((alert) => ({
      label: alert.title,
      value: riskLevelLabel(alert.level),
      meta: "Risk uyarısı",
      detail: alert.description
    }))
  ];

  const assetRows = ["Nakit", "Dolar", "Borsa", "Altın"].map((label) => {
    const item = investmentPortfolio.allocation.find((allocation) => normalizeAssetLabel(allocation.label) === label);
    return {
      label,
      weight: item?.weight ?? 0,
      percent: `${(item?.weight ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`,
      value: formatTry(item?.valueTry ?? 0),
      className: assetClass(label),
      color: assetColor(label)
    };
  });
  let segmentOffset = 0;
  const assetSegments: AssetSegment[] = assetRows
    .filter((asset) => asset.weight > 0)
    .map((asset) => {
      const segment = {
        ...asset,
        offset: segmentOffset,
        weight: Math.min(Math.max(asset.weight, 0), 100)
      };
      segmentOffset += segment.weight;
      return segment;
    });

  const sections: DashboardSection[] = [
    {
      id: "expenses",
      className: "expense-cell",
      eyebrow: "Aylık harcama",
      title: formatTry(dashboard.expenses),
      rows: expenseRows,
      previewRows: topExpenses
    },
    {
      id: "income",
      className: "income-cell",
      eyebrow: "Aylık gelir",
      title: formatTry(dashboard.income),
      rows: incomeRows,
      previewRows: incomeRows.slice(0, 3)
    },
    {
      id: "potential",
      className: "potential-cell",
      eyebrow: "Potansiyel gelirsiz harcama",
      title: formatTry(leakImpact + (riskyScenario?.spendAmount ?? 0)),
      rows: detailedPotentialRows,
      previewRows: potentialRows,
      wide: true
    }
  ];

  return (
    <AppShell active="/">
      <DashboardOverview
        totalAssets={formatTry(investmentPortfolio.totalMarketValueTry)}
        assetRows={assetRows}
        assetSegments={assetSegments}
        sections={sections}
        net={{
          title: formatTry(netBalance),
          progress: Math.max(12, Math.min(100, Math.round((netBalance / dashboard.income) * 100))),
          breakdown: [
            { label: "Gelir", value: formatTry(dashboard.income), meta: "Aylık gelir" },
            { label: "Gider", value: formatTry(dashboard.expenses), meta: "Aylık gider" },
            { label: "Güvenli limit", value: formatTry(whatIf.safeLimit), meta: "What-if limiti" }
          ]
        }}
      />
    </AppShell>
  );
}

function formatTry(value: number) {
  return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value)} TL`;
}

function formatPercent(value: number) {
  return `%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long" }).format(new Date(value));
}

function normalizeAssetLabel(label: string) {
  const lower = label.toLocaleLowerCase("tr-TR");
  if (lower.includes("nakit") || lower.includes("mevduat")) return "Nakit";
  if (lower.includes("hisse") || lower.includes("borsa") || lower.includes("stock")) return "Borsa";
  if (lower.includes("alt")) return "Altın";
  if (lower.includes("döviz") || lower.includes("doviz") || lower.includes("forex") || lower.includes("usd") || lower.includes("dolar")) return "Dolar";
  if (lower.includes("kripto") || lower.includes("crypto")) return "Kripto";
  return label;
}

function assetClass(label: string) {
  const lower = label.toLocaleLowerCase("tr-TR");
  if (lower.includes("nakit") || lower.includes("mevduat")) return "asset-cash";
  if (lower.includes("hisse") || lower.includes("borsa") || lower.includes("stock")) return "asset-stock";
  if (lower.includes("alt")) return "asset-gold";
  if (lower.includes("döviz") || lower.includes("doviz") || lower.includes("forex") || lower.includes("usd") || lower.includes("dolar")) return "asset-fx";
  return "asset-other";
}

function assetColor(label: string) {
  const className = assetClass(label);
  if (className === "asset-cash") return "#58d6ff";
  if (className === "asset-stock") return "#2f87ff";
  if (className === "asset-gold") return "#80bfff";
  if (className === "asset-fx") return "#173a70";
  return "#607894";
}

function leakIssueLabel(issue: "unused" | "duplicate" | "small_leak" | "price_increase") {
  if (issue === "unused") return "Kullanılmayan abonelik";
  if (issue === "duplicate") return "Çift abonelik";
  if (issue === "price_increase") return "Fiyat artışı";
  return "Küçük sızıntı";
}

function riskLevelLabel(level: "low" | "medium" | "high" | "critical") {
  if (level === "critical") return "Kritik";
  if (level === "high") return "Yüksek";
  if (level === "medium") return "Orta";
  return "Düşük";
}

function actionStatusLabel(status: string) {
  if (status === "pending") return "Bekliyor";
  if (status === "done") return "Tamamlandı";
  if (status === "dismissed") return "Ertelendi";
  return status;
}
