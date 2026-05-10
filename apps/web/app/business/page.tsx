import { Building2, CircleDollarSign, Clock3, Landmark } from "lucide-react";
import type { ReactNode } from "react";
import type { Business, BusinessDashboard, CollectionScore } from "@fintwin/shared";
import { AppShell } from "../../components/app-shell";
import { getBusinessCustomers, getBusinessDashboard, getBusinesses, getCollectionScore } from "../../lib/api";
import { requireAuthSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

type BusinessPageData = {
  business: Business;
  dashboard: BusinessDashboard;
  scores: CollectionScore[];
};

export default async function BusinessPage() {
  const { token } = await requireAuthSession();
  const businessData = await loadBusinessData(token);
  if (!businessData) {
    return (
      <AppShell active="/business">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Ayrı KOBİ Modülü</p>
            <h1>KOBİ profili henüz oluşturulmamış.</h1>
            <p className="header-subtitle">Bu hesapta kayıtlı işletme verisi bulunmadığı için yalnızca DB akışı bekleniyor.</p>
          </div>
        </header>
        <section className="panel">
          <div className="section-title">
            <span>Kurulum gerekli</span>
            <strong>İşletme onboarding</strong>
          </div>
          <p className="market-note">KOBİ modülü için işletme oluşturma ekranı veya DB seed kaydı eklenmeli.</p>
        </section>
      </AppShell>
    );
  }

  const { business, dashboard, scores } = businessData;

  return (
    <AppShell active="/business">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Ayrı KOBİ Modülü</p>
          <h1>{business.name}</h1>
          <p className="header-subtitle">{business.sector} işletme metrikleri oturum kullanıcısına bağlı DB kayıtlarından okunur.</p>
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
          {scores.length > 0 ? (
            scores.map((score) => (
              <div className="score-row" key={score.customerId}>
                <span>{score.customerId}</span>
                <strong>{score.score}/100</strong>
                <small>{score.recommendation}</small>
              </div>
            ))
          ) : (
            <div className="empty-state">Tahsilat skoru için müşteri kaydı yok.</div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

async function loadBusinessData(token: string): Promise<BusinessPageData | null> {
  const [business] = await getBusinesses({ token });
  if (!business) return null;

  const [dashboard, customers] = await Promise.all([getBusinessDashboard(business.id, { token }), getBusinessCustomers(business.id, { token })]);
  const scores = await Promise.all(customers.slice(0, 2).map((customer) => getCollectionScore(business.id, customer.id, { token })));
  return { business, dashboard, scores };
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
