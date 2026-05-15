import type { CSSProperties } from "react";
import type { DashboardPeriod } from "@fintwin/shared";
import { Bell, FileUp, Landmark, PiggyBank, Plus, ReceiptText, ShieldAlert, Target, WalletCards } from "lucide-react";
import { AppShell } from "./app-shell";
import { ManualTransactionPanel } from "./dashboard-actions";
import { getCampaignReadiness, getPersonalDashboard } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { requirePersonalSession } from "../lib/server-auth";

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

export async function PersonalDashboardPage({ searchParams }: DashboardPageProps) {
  const { token, user } = await requirePersonalSession();
  const params = await searchParams;
  const period = parseDashboardPeriod(params?.period);
  const dataOptions = { token, period };
  const todayLabel = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const [dashboard, campaign] = await Promise.all([
    getPersonalDashboard(dataOptions),
    getCampaignReadiness(dataOptions)
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
  const categoryTotal = dashboard.categoryBreakdown.reduce((total, item) => total + Math.abs(item.value), 0);

  return (
    <AppShell active="/dashboard" accountType="personal" displayName={user.name}>
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

      <section className="dashboard-reference-layout">
        <div className="dashboard-reference-main">
          <PeriodTabs active={period} />
          <section className="metric-grid dashboard-metric-grid">
            <Metric icon={<WalletCards size={18} />} label="Gelir" value={formatCurrency(dashboard.income)} caption={periodLabel} tone="accent" />
            <Metric icon={<ReceiptText size={18} />} label="Gider" value={formatCurrency(dashboard.expenses)} caption={periodLabel} tone="warn" />
            <Metric icon={<PiggyBank size={18} />} label="Bakiye" value={formatCurrency(dashboard.balance)} caption={periodNetCaptions[dashboard.period]} tone="success" />
            <Metric
              icon={<ShieldAlert size={18} />}
              label="Dikkatli harcama sınırı"
              value={hasFinancialData ? formatCurrency(campaign.safeLimit) : "Beklemede"}
              caption={hasFinancialData ? "Üstündeki alışverişleri tekrar düşün" : "gelir/gider verisi bekleniyor"}
              tone="danger"
            />
          </section>

          <section className="panel dashboard-trend-panel">
            <div className="section-title">
              <span>Nakit ve kategori trendi</span>
              <strong>{periodLabel}</strong>
            </div>
            <DashboardBars values={dashboard.categoryBreakdown.map((item) => item.value)} />
            <div className="dashboard-category-row">
              {dashboard.categoryBreakdown.slice(0, 5).map((item) => (
                <span key={item.categoryId}>
                  <i style={{ "--bar": `${Math.max(8, Math.round((Math.abs(item.value) / Math.max(1, categoryTotal)) * 100))}%` } as CSSProperties} />
                  {item.name}
                  <strong>{Math.round((Math.abs(item.value) / Math.max(1, categoryTotal)) * 100)}%</strong>
                </span>
              ))}
              {!dashboard.categoryBreakdown.length ? <em>Trend için işlem verisi bekleniyor.</em> : null}
            </div>
          </section>

          <section className="dashboard-lower-grid">
            <ManualTransactionPanel />
          </section>
        </div>

        <aside className="dashboard-reference-rail">
          <section className="health-card panel">
            <ScoreRing active={hasFinancialData} score={dashboard.financialHealthScore} />
            <div>
              <p className="eyebrow muted">Sağlık Skoru</p>
              <h2>{healthTitle}</h2>
              <p>
                {hasFinancialData
                  ? `${dashboard.upcomingActions.length} aksiyon ve ${dashboard.riskAlerts.length} risk sinyali detay ekranlarında izleniyor.`
                  : "Yeni işlem, fiş veya ekstre eklendiğinde skorlar otomatik güncellenir."}
              </p>
              <div className="chip-row">
                <span className="chip accent">{hasActionData ? `${dashboard.upcomingActions.length} öneri` : "Aksiyon bekleniyor"}</span>
                <span className="chip warn">{hasRiskData ? `${dashboard.riskAlerts.length} risk` : "Risk yok"}</span>
              </div>
            </div>
          </section>

          <section className="panel quick-action-panel">
            <div className="section-title">
              <span>Hızlı işlemler</span>
              <strong>4</strong>
            </div>
            <a href="#manual-entry">
              <Plus size={16} />
              Gelir / gider ekle
            </a>
            <a href="/receipt">
              <FileUp size={16} />
              Fiş veya ekstre yükle
            </a>
            <a href="/actions">
              <Bell size={16} />
              Aksiyonları incele
            </a>
            <a href="/agent">
              <Target size={16} />
              Agent'a soru sor
            </a>
          </section>

          <section className="module-grid personal-module-grid">
            <ModuleCard
              href="/portfolio"
              icon={<Landmark size={20} />}
              label="Yatırım Portföyü"
              value="Portföye git"
              caption="Varlık dağılımı ve fiyat verisi"
            />
            <ModuleCard href="/goals" icon={<Target size={20} />} label="Hedefler ve Limitler" value={`${dashboard.goals.length} hedef`} caption="Birikim planı ve kategori limitleri" />
          </section>
        </aside>
      </section>
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
        <a className={option.value === active ? "active" : ""} href={`/dashboard?period=${option.value}`} key={option.value}>
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

function ScoreRing({ active, score }: { active: boolean; score: number }) {
  return (
    <div className="score-ring" style={{ "--score": active ? score : 0 } as CSSProperties}>
      <strong>{active ? score : "--"}</strong>
      {active ? <span>/100</span> : null}
      <small>sağlık</small>
    </div>
  );
}

function DashboardBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values.map((value) => Math.abs(value)));
  const visible = values.length ? values.slice(0, 12) : [0, 0, 0, 0, 0, 0, 0, 0];
  return (
    <div className="dashboard-bars" aria-label="Kategori harcama barları">
      {visible.map((value, index) => {
        const height = value ? Math.max(12, Math.round((Math.abs(value) / max) * 100)) : 12;
        return <span key={`${value}-${index}`} style={{ "--bar": `${height}%` } as CSSProperties} />;
      })}
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
