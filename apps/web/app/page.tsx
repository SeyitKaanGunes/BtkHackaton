import type { CSSProperties } from "react";
import type { DashboardPeriod } from "@fintwin/shared";
import { Landmark, PiggyBank, ReceiptText, ShieldAlert, WalletCards } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { ManualTransactionPanel } from "../components/dashboard-actions";
import { getCampaignReadiness, getInvestmentPortfolio, getPersonalDashboard } from "../lib/api";
import { requirePersonalSession } from "../lib/server-auth";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<{ period?: string }>;
};

const dashboardPeriodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "daily", label: "Günlük" },
  { value: "weekly", label: "Haftalık" },
  { value: "monthly", label: "Aylık" },
  { value: "yearly", label: "Yıllık" }
];

const periodNetCaptions: Record<DashboardPeriod, string> = {
  daily: "günlük net",
  weekly: "haftalık net",
  monthly: "aylık net",
  yearly: "yıllık net"
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { token, user } = await requirePersonalSession();
  const params = await searchParams;
  const period = parseDashboardPeriod(params?.period);
  const dataOptions = { token, period };
  const todayLabel = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const [dashboard, campaign, portfolio] = await Promise.all([
    getPersonalDashboard(dataOptions),
    getCampaignReadiness(dataOptions),
    getInvestmentPortfolio({ token })
  ]);
  const hasFinancialData =
    dashboard.income > 0 ||
    dashboard.expenses > 0 ||
    dashboard.balance !== 0 ||
    dashboard.categoryBreakdown.length > 0 ||
    dashboard.goals.length > 0 ||
    campaign.score > 0;
  const hasActionData = dashboard.upcomingActions.length > 0;
  const hasRiskData = dashboard.riskAlerts.length > 0;
  const healthTitle = hasFinancialData ? healthLabel(dashboard.financialHealthScore) : "Veri bekleniyor";
  const periodLabel = dashboard.periodLabel;

  return (
    <AppShell active="/" accountType={user.accountType}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>Merhaba {user.name}.</h1>
          <p className="header-subtitle">
            {hasFinancialData
              ? "Finansal ikizin ana özet ekranı. Detaylı risk, senaryo, kategori ve abonelik analizlerine sol menüden geçebilirsin."
              : "Gelir, gider, fiş veya ekstre eklediğinde finansal ikizin gerçek analiz üretmeye başlayacak."}
          </p>
        </div>
      </header>

      <PeriodTabs active={period} />

      <section className="health-card panel">
        <ScoreRing score={dashboard.financialHealthScore} />
        <div>
          <p className="eyebrow muted">Finansal Sağlık</p>
          <h2>{healthTitle}</h2>
          <p>
            {hasFinancialData
              ? `Ana özet sade tutuldu; ${dashboard.upcomingActions.length} aksiyon ve ${dashboard.riskAlerts.length} risk sinyali kendi ekranlarında detaylandırılıyor.`
              : "Henüz analiz yapılacak finansal hareket yok. Yeni işlem, fiş veya ekstre eklendiğinde skorlar otomatik güncellenir."}
          </p>
          <div className="chip-row">
            <span className="chip accent">{hasActionData ? `${dashboard.upcomingActions.length} öneri` : "Aksiyon bekleniyor"}</span>
            <span className="chip warn">{hasRiskData ? `${dashboard.riskAlerts.length} risk` : "Risk yok"}</span>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <Metric icon={<WalletCards size={18} />} label="Gelir" value={`${dashboard.income.toLocaleString("tr-TR")} TL`} caption={periodLabel} tone="accent" />
        <Metric icon={<ReceiptText size={18} />} label="Gider" value={`${dashboard.expenses.toLocaleString("tr-TR")} TL`} caption={periodLabel} tone="warn" />
        <Metric icon={<PiggyBank size={18} />} label="Bakiye" value={`${dashboard.balance.toLocaleString("tr-TR")} TL`} caption={periodNetCaptions[dashboard.period]} tone="success" />
        <Metric
          icon={<ShieldAlert size={18} />}
          label="Güvenli limit"
          value={hasFinancialData ? `${campaign.safeLimit.toLocaleString("tr-TR")} TL` : "Beklemede"}
          caption={hasFinancialData ? `kampanya skoru ${campaign.score}` : "veri bekleniyor"}
          tone="danger"
        />
      </section>

      <section className="module-grid personal-module-grid">
        <ModuleCard
          href="/portfolio"
          icon={<Landmark size={20} />}
          label="Yatırım Portföyü"
          value={portfolio ? `${portfolio.totalMarketValueTry.toLocaleString("tr-TR")} TL` : "Bağlantı bekleniyor"}
          caption={portfolio ? `${portfolio.positions.length} varlık · %${Math.round(portfolio.totalProfitLossPercent)}` : "Portföy ekranına git"}
        />
      </section>

      <ManualTransactionPanel initialUser={user} />
    </AppShell>
  );
}

function healthLabel(score: number) {
  if (score >= 80) return "Güçlü seviye";
  if (score >= 60) return "Dengeli seviye";
  if (score >= 40) return "İzleme gerekli";
  return "Riskli seviye";
}

function parseDashboardPeriod(value: string | undefined): DashboardPeriod {
  return dashboardPeriodOptions.some((option) => option.value === value) ? (value as DashboardPeriod) : "monthly";
}

function PeriodTabs({ active }: { active: DashboardPeriod }) {
  return (
    <nav className="period-tabs" aria-label="Dashboard dönemi">
      {dashboardPeriodOptions.map((option) => (
        <a className={option.value === active ? "active" : ""} href={`/?period=${option.value}`} key={option.value}>
          {option.label}
        </a>
      ))}
    </nav>
  );
}

function ModuleCard({ href, icon, label, value, caption }: { href: string; icon: React.ReactNode; label: string; value: string; caption: string }) {
  return (
    <a className="module-card" href={href}>
      <span className="module-icon">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{caption}</em>
      </span>
    </a>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="score-ring" style={{ "--score": score } as CSSProperties}>
      <strong>{score}</strong>
      <span>/100</span>
      <small>sağlık</small>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  caption,
  tone = "accent"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption?: string;
  tone?: "accent" | "warn" | "danger" | "success";
}) {
  return (
    <div className={`metric ${tone}`}>
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      {caption ? <small>{caption}</small> : null}
    </div>
  );
}
