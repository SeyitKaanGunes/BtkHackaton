import { Building2, CircleDollarSign, Clock3, Landmark } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { getBusinessDashboard, getCollectionScore } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const [dashboard, atlas, mavi] = await Promise.all([
    getBusinessDashboard(),
    getCollectionScore("cus-2"),
    getCollectionScore("cus-3")
  ]);

  return (
    <AppShell active="/business">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Ayrı KOBİ Modülü</p>
          <h1>AI CFO Lite bireysel metriklerden ayrılmıştır.</h1>
        </div>
        <div className="health-score">
          <Building2 size={22} />
          <span>Likidite riski</span>
          <strong>{dashboard.liquidityRisk}</strong>
        </div>
      </header>

      <section className="metric-grid">
        <Metric icon={<Landmark size={20} />} label="Kasa" value={`${dashboard.cashBalance.toLocaleString("tr-TR")} TL`} />
        <Metric icon={<Clock3 size={20} />} label="30 gün" value={`${dashboard.projected30Days.toLocaleString("tr-TR")} TL`} />
        <Metric icon={<Clock3 size={20} />} label="60 gün" value={`${dashboard.projected60Days.toLocaleString("tr-TR")} TL`} />
        <Metric icon={<CircleDollarSign size={20} />} label="90 gün" value={`${dashboard.projected90Days.toLocaleString("tr-TR")} TL`} />
      </section>

      <section className="split-layout">
        <div className="panel">
          <div className="section-title">
            <span>Yaklaşan Ödemeler</span>
            <strong>{dashboard.upcomingPayments.length} kayıt</strong>
          </div>
          <div className="action-list">
            {dashboard.upcomingPayments.map((event) => (
              <div className="action-row" key={event.id}>
                <span>{event.title}</span>
                <strong>{event.amount.toLocaleString("tr-TR")} TL</strong>
                <small>{event.dueAt}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="section-title">
            <span>Tahsilat Skorları</span>
            <strong>KOBİ riski</strong>
          </div>
          {[atlas, mavi].map((score) => (
            <div className="score-row" key={score.customerId}>
              <span>{score.customerId}</span>
              <strong>{score.score}/100</strong>
              <small>{score.recommendation}</small>
            </div>
          ))}
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
