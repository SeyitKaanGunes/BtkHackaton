import type { CSSProperties } from "react";
import type { DashboardPeriod } from "@fintwin/shared";
import { AlertTriangle, Bell, Brain, BriefcaseBusiness, Landmark, PiggyBank, ReceiptText, ShieldAlert, WalletCards } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { SpendingCharts } from "../components/dashboard-charts";
import { ApiRequestError, getBusinessOverview, getCampaignReadiness, getInvestmentPortfolio, getPersonalDashboard, getSpendingDna, getSubscriptionLeaks, getWhatIf } from "../lib/api";
import { requireAuthSession } from "../lib/server-auth";

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
  const { token, user } = await requireAuthSession();
  const params = await searchParams;
  const period = parseDashboardPeriod(params?.period);
  const dataOptions = { token, period };
  const todayLabel = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const [dashboard, dna, campaign, leaks, whatIf, portfolio, businessOverview] = await Promise.all([
    getPersonalDashboard(dataOptions),
    getSpendingDna(dataOptions),
    getCampaignReadiness(dataOptions),
    getSubscriptionLeaks({ token }),
    getWhatIf({ token }),
    getInvestmentPortfolio({ token }),
    getOptionalBusinessOverview(token)
  ]);
  const hasFinancialData =
    dashboard.income > 0 ||
    dashboard.expenses > 0 ||
    dashboard.balance !== 0 ||
    dashboard.categoryBreakdown.length > 0 ||
    dashboard.goals.length > 0 ||
    campaign.score > 0 ||
    whatIf.cards.length > 0;
  const hasActionData = dashboard.upcomingActions.length > 0;
  const hasRiskData = dashboard.riskAlerts.length > 0 || leaks.length > 0;
  const healthTitle = hasFinancialData ? healthLabel(dashboard.financialHealthScore) : "Veri bekleniyor";
  const periodLabel = dashboard.periodLabel;

  return (
    <AppShell active="/">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>Merhaba {user.name}.</h1>
          <p className="header-subtitle">
            {hasFinancialData
              ? "Finansal ikizin bu ayki gelir, gider, risk ve aksiyon sinyallerini gerçek kayıtlarından izliyor."
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
              ? `Güvenli aralıkta kalman için ${dashboard.upcomingActions.length} öneri ve ${dashboard.riskAlerts.length + leaks.length} risk sinyali izleniyor.`
              : "Henüz analiz yapılacak finansal hareket yok. Yeni işlem, fiş veya ekstre eklendiğinde skorlar otomatik güncellenir."}
          </p>
          <div className="chip-row">
            <span className="chip accent">{hasActionData ? `${dashboard.upcomingActions.length} öneri` : "Aksiyon bekleniyor"}</span>
            <span className="chip warn">{hasRiskData ? `${dashboard.riskAlerts.length + leaks.length} risk` : "Risk yok"}</span>
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

      <section className="module-grid">
        <ModuleCard
          href="/portfolio"
          icon={<Landmark size={20} />}
          label="Yatırım Portföyü"
          value={portfolio ? `${portfolio.totalMarketValueTry.toLocaleString("tr-TR")} TL` : "Bağlantı bekleniyor"}
          caption={portfolio ? `${portfolio.positions.length} varlık · %${Math.round(portfolio.totalProfitLossPercent)}` : "Portföy ekranına git"}
        />
        <ModuleCard
          href="/business"
          icon={<BriefcaseBusiness size={20} />}
          label={businessOverview?.business.name ?? "KOBİ Modülü"}
          value={businessOverview ? `${businessOverview.dashboard.cashBalance.toLocaleString("tr-TR")} TL` : "İşletme bekleniyor"}
          caption={businessOverview ? `${businessOverview.business.sector} · ${riskTitle(businessOverview.dashboard.liquidityRisk)}` : "KOBİ ekranına git"}
        />
      </section>

      <SpendingCharts dashboard={dashboard} dna={dna} />

      <section className="risk-alert-grid">
        {dashboard.riskAlerts.map((alert) => (
          <article className={`alert-card ${alertTone(alert.level)}`} key={alert.title}>
            <AlertTriangle size={20} />
            <div>
              <span>{alert.title}</span>
              <strong>{riskTitle(alert.level)}</strong>
              <p>{alert.description}</p>
            </div>
          </article>
        ))}
        {leaks.length ? (
          <article className="alert-card danger">
            <Brain size={20} />
            <div>
              <span>Abonelik sızıntısı</span>
              <strong>{leaks.length} bulgu açık.</strong>
              <p>Aylık {leaks.reduce((total, leak) => total + leak.monthlyImpact, 0).toLocaleString("tr-TR")} TL geri kazanılabilir alan var.</p>
            </div>
          </article>
        ) : null}
        {!hasRiskData ? <EmptyState message="Şu an gösterilecek bütçe riski veya abonelik sızıntısı yok." /> : null}
      </section>

      <section className="split-layout">
        <div className="panel">
          <div className="section-title">
            <span>What-if senaryoları</span>
            <strong>{hasFinancialData ? `${whatIf.safeLimit.toLocaleString("tr-TR")} TL güvenli limit` : "Veri bekleniyor"}</strong>
          </div>
          {hasFinancialData ? (
            <div className="scenario-list">
              {whatIf.cards.map((card) => (
                <article className={`scenario ${card.id}`} key={card.id}>
                  <span>{card.label}</span>
                  <strong>{card.spendAmount.toLocaleString("tr-TR")} TL</strong>
                  <small>{card.recommendation}</small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="Gelir, gider veya bütçe verisi eklenince what-if senaryoları gerçek limitlerle hesaplanır." />
          )}
        </div>
        <div className="panel">
          <div className="section-title">
            <span>Emotional Delay</span>
            <strong>{hasFinancialData ? `${whatIf.emotionalDelayMinutes || 0} dk` : "Beklemede"}</strong>
          </div>
          <div className="delay-copy">
            <AlertTriangle size={22} />
            <p>
              {hasFinancialData
                ? "Riskli harcama sinyali oluştuğunda bekleme süresi ve güvenli limit önerisi burada görünür."
                : "Harcama geçmişi oluşmadan bekleme süresi önermiyoruz; önce gerçek finansal hareketleri ekle."}
            </p>
          </div>
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <div className="section-title">
            <span>Finansal Aksiyon Merkezi</span>
            <span className="chip warn">{dashboard.upcomingActions.length} açık aksiyon</span>
          </div>
          {dashboard.upcomingActions.length ? (
            <div className="action-list">
              {dashboard.upcomingActions.map((action) => (
                <div className="action-row" key={action.id}>
                  <Bell size={18} />
                  <span>{action.title}</span>
                  <small>{action.status}</small>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Onay bekleyen finansal aksiyon yok." />
          )}
        </div>
        <div className="panel">
          <div className="section-title">
            <span>Akıllı Abonelik Avcısı</span>
            <span className="chip danger">{leaks.length} bulgu</span>
          </div>
          {leaks.length ? (
            <div className="action-list">
              {leaks.map((leak) => (
                <div className="action-row" key={`${leak.subscriptionId}-${leak.issue}`}>
                  <Brain size={18} />
                  <span>{leak.merchant}</span>
                  <small>{leak.monthlyImpact.toLocaleString("tr-TR")} TL</small>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Tekrar eden abonelik veya sızıntı bulgusu yok." />
          )}
        </div>
      </section>
    </AppShell>
  );
}

async function getOptionalBusinessOverview(token: string) {
  try {
    return await getBusinessOverview({ token });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
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

function alertTone(level: string) {
  return level === "critical" || level === "high" ? "danger" : level === "medium" ? "warn" : "";
}

function riskTitle(level: string) {
  if (level === "critical") return "Acil aksiyon gerekli.";
  if (level === "high") return "Yakından takip edilmeli.";
  if (level === "medium") return "Kontrollü izlenmeli.";
  return "Düşük risk.";
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
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
