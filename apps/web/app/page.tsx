import { AlertTriangle, Brain, CalendarClock, Gauge, PiggyBank, ReceiptText, ShieldAlert, WalletCards } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { SpendingCharts } from "../components/dashboard-charts";
import { InvestmentPortfolio } from "../components/investment-portfolio";
import { getCampaignReadiness, getInvestmentPortfolio, getPersonalDashboard, getSpendingDna, getSubscriptionLeaks, getWhatIf } from "../lib/api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [dashboard, dna, campaign, leaks, whatIf, investmentPortfolio] = await Promise.all([
    getPersonalDashboard(),
    getSpendingDna(),
    getCampaignReadiness(),
    getSubscriptionLeaks(),
    getWhatIf(),
    getInvestmentPortfolio()
  ]);

  return (
    <AppShell active="/">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Kişisel AI Financial Twin</p>
          <h1>Karar almadan önce bütçe etkisini gör.</h1>
        </div>
        <div className="health-score">
          <Gauge size={22} />
          <span>Finansal sağlık</span>
          <strong>{dashboard.financialHealthScore}/100</strong>
        </div>
      </header>

      <section className="metric-grid">
        <Metric icon={<WalletCards size={20} />} label="Aylık gelir" value={`${dashboard.income.toLocaleString("tr-TR")} TL`} />
        <Metric icon={<ReceiptText size={20} />} label="Aylık gider" value={`${dashboard.expenses.toLocaleString("tr-TR")} TL`} />
        <Metric icon={<PiggyBank size={20} />} label="Tasarruf oranı" value={`%${dashboard.savingsRate}`} />
        <Metric icon={<ShieldAlert size={20} />} label="Kampanya skoru" value={`${campaign.score}/100`} />
      </section>

      <SpendingCharts dashboard={dashboard} dna={dna} />

      <InvestmentPortfolio initialPortfolio={investmentPortfolio} />

      <section className="split-layout">
        <div className="panel">
          <div className="section-title">
            <span>Scenario Compare</span>
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
            <strong>{dashboard.upcomingActions.length} açık aksiyon</strong>
          </div>
          <div className="action-list">
            {dashboard.upcomingActions.map((action) => (
              <div className="action-row" key={action.id}>
                <CalendarClock size={18} />
                <span>{action.title}</span>
                <small>{action.status}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="section-title">
            <span>Akıllı Abonelik Avcısı</span>
            <strong>{leaks.length} bulgu</strong>
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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
