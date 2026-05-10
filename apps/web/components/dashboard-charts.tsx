"use client";

import type { DashboardSummary, SpendingDna } from "@fintwin/shared";

export function SpendingCharts({ dashboard, dna }: { dashboard: DashboardSummary; dna: SpendingDna }) {
  const totalCategorySpend = dashboard.categoryBreakdown.reduce((total, item) => total + item.value, 0);
  const riskRows = dna.categories.filter((item) => item.monthlySpend > 0 || item.riskScore > 0).slice(0, 5);

  return (
    <section className="chart-grid" aria-label="Finans grafikleri">
      <div className="panel">
        <div className="section-title">
          <span>Kategori Dağılımı</span>
          <strong>{dashboard.expenses.toLocaleString("tr-TR")} TL</strong>
        </div>
        {dashboard.categoryBreakdown.length ? (
          <div className="progress-list">
            {dashboard.categoryBreakdown.slice(0, 5).map((item) => {
              const width = totalCategorySpend > 0 ? Math.round((item.value / totalCategorySpend) * 100) : 0;
              return (
                <div className="progress-row" key={item.categoryId}>
                  <div>
                    <span>{item.name}</span>
                    <strong>{item.value.toLocaleString("tr-TR")} TL</strong>
                  </div>
                  <div className="progress-track" aria-hidden="true">
                    <span style={{ width: `${width}%`, background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyChart message="Fiş veya ekstre import edildiğinde kategori dağılımı burada oluşur." />
        )}
      </div>
      <div className="panel">
        <div className="section-title">
          <span>Spending DNA Riskleri</span>
          <strong>{dna.overallRisk}/100</strong>
        </div>
        {riskRows.length ? (
          <div className="progress-list">
            <RiskRow label="Genel risk" value={dna.overallRisk} />
            {riskRows.map((item) => (
              <RiskRow key={item.categoryId} label={item.categoryName} value={item.riskScore} />
            ))}
          </div>
        ) : (
          <EmptyChart message="Yeterli harcama verisi geldikten sonra risk sinyalleri hesaplanır." />
        )}
      </div>
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

function RiskRow({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? "danger" : value >= 60 ? "warn" : "accent";
  return (
    <div className={`progress-row ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}/100</strong>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${Math.max(4, Math.min(value, 100))}%` }} />
      </div>
    </div>
  );
}
