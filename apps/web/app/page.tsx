import type { CSSProperties } from "react";
import { AlertTriangle, Bell, Brain, PiggyBank, ReceiptText, ShieldAlert, WalletCards } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { SpendingCharts } from "../components/dashboard-charts";
import { getCampaignReadiness, getPersonalDashboard, getSpendingDna, getSubscriptionLeaks, getWhatIf } from "../lib/api";
import { requireAuthToken } from "../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const token = await requireAuthToken();
  const [dashboard, dna, campaign, leaks, whatIf] = await Promise.all([
    getPersonalDashboard({ token }),
    getSpendingDna({ token }),
    getCampaignReadiness({ token }),
    getSubscriptionLeaks({ token }),
    getWhatIf({ token })
  ]);

  return (
    <AppShell active="/">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Pazartesi · 09 Mayıs</p>
          <h1>Merhaba Seyit.</h1>
          <p className="header-subtitle">Teknoloji harcamaların bu ay güvenli limiti aştı. Sakin bir aksiyon planı hazır.</p>
        </div>
      </header>

      <section className="health-card panel">
        <ScoreRing score={dashboard.financialHealthScore} />
        <div>
          <p className="eyebrow muted">Finansal Sağlık</p>
          <h2>Orta seviye</h2>
          <p>Güvenli aralıkta kalman için {dashboard.upcomingActions.length} öneri hazırlandı. Onaylamadan hiçbir işlem yapılmaz.</p>
          <div className="chip-row">
            <span className="chip accent">{dashboard.upcomingActions.length} öneri</span>
            <span className="chip warn">{leaks.length} risk</span>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <Metric icon={<WalletCards size={18} />} label="Gelir" value={`${dashboard.income.toLocaleString("tr-TR")} TL`} caption="Mayıs 2026" tone="accent" />
        <Metric icon={<ReceiptText size={18} />} label="Gider" value={`${dashboard.expenses.toLocaleString("tr-TR")} TL`} caption="sabit + kart" tone="warn" />
        <Metric icon={<PiggyBank size={18} />} label="Bakiye" value={`${(dashboard.income - dashboard.expenses).toLocaleString("tr-TR")} TL`} caption="aylık net" tone="success" />
        <Metric icon={<ShieldAlert size={18} />} label="Güvenli limit" value={`${whatIf.safeLimit.toLocaleString("tr-TR")} TL`} caption={`kampanya skoru ${campaign.score}`} tone="danger" />
      </section>

      <SpendingCharts dashboard={dashboard} dna={dna} />

      <section className="risk-alert-grid">
        <article className="alert-card warn">
          <AlertTriangle size={20} />
          <div>
            <span>Teknoloji kampanya riski</span>
            <strong>Önümüzdeki 72 saat kritik.</strong>
            <p>Kampanya hassasiyetin yüksek. Harcamadan önce what-if simülasyonunu kontrol et.</p>
          </div>
        </article>
        <article className="alert-card danger">
          <Brain size={20} />
          <div>
            <span>Abonelik sızıntısı</span>
            <strong>{leaks.length} bulgu açık.</strong>
            <p>Aylık {leaks.reduce((total, leak) => total + leak.monthlyImpact, 0).toLocaleString("tr-TR")} TL geri kazanılabilir alan var.</p>
          </div>
        </article>
      </section>

      <section className="split-layout">
        <div className="panel">
          <div className="section-title">
            <span>What-if senaryoları</span>
            <strong>{whatIf.safeLimit.toLocaleString("tr-TR")} TL güvenli limit</strong>
          </div>
          <div className="scenario-list">
            {whatIf.cards.map((card) => (
              <article className={`scenario ${card.id}`} key={card.id}>
                <span>{card.label}</span>
                <strong>{card.spendAmount.toLocaleString("tr-TR")} TL</strong>
                <small>{card.recommendation}</small>
              </article>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="section-title">
            <span>Emotional Delay</span>
            <strong>{whatIf.emotionalDelayMinutes || 10} dk</strong>
          </div>
          <div className="delay-copy">
            <AlertTriangle size={22} />
            <p>Teknoloji kategorisi yüksek riskte. Satın almadan önce bekleme süresi ve güvenli limit önerisi oluşturuldu.</p>
          </div>
        </div>
      </section>

      <section className="split-layout">
        <div className="panel">
          <div className="section-title">
            <span>Finansal Aksiyon Merkezi</span>
            <span className="chip warn">{dashboard.upcomingActions.length} açık aksiyon</span>
          </div>
          <div className="action-list">
            {dashboard.upcomingActions.map((action) => (
              <div className="action-row" key={action.id}>
                <Bell size={18} />
                <span>{action.title}</span>
                <small>{action.status}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="section-title">
            <span>Akıllı Abonelik Avcısı</span>
            <span className="chip danger">{leaks.length} bulgu</span>
          </div>
          <div className="action-list">
            {leaks.map((leak) => (
              <div className="action-row" key={`${leak.subscriptionId}-${leak.issue}`}>
                <Brain size={18} />
                <span>{leak.merchant}</span>
                <small>{leak.monthlyImpact.toLocaleString("tr-TR")} TL</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
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
