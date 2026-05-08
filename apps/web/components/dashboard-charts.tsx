"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DashboardSummary, SpendingDna } from "@finshadow/shared";

export function SpendingCharts({ dashboard, dna }: { dashboard: DashboardSummary; dna: SpendingDna }) {
  const riskRows = dna.categories.slice(0, 5).map((item) => ({
    name: item.categoryName,
    risk: item.riskScore
  }));

  return (
    <section className="chart-grid" aria-label="Finans grafikleri">
      <div className="panel">
        <div className="section-title">
          <span>Kategori Dağılımı</span>
          <strong>{dashboard.expenses.toLocaleString("tr-TR")} TL</strong>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={260} minWidth={260}>
            <PieChart>
              <Pie
                data={dashboard.categoryBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="82%"
                startAngle={180}
                endAngle={0}
                innerRadius={70}
                outerRadius={112}
                paddingAngle={2}
              >
                {dashboard.categoryBreakdown.map((entry) => (
                  <Cell fill={entry.color} key={entry.categoryId} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toLocaleString("tr-TR")} TL`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="panel">
        <div className="section-title">
          <span>Spending DNA Riskleri</span>
          <strong>{dna.overallRisk}/100</strong>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={260} minWidth={260}>
            <BarChart data={riskRows} layout="vertical" margin={{ left: 12, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis dataKey="name" type="category" width={86} />
              <Tooltip formatter={(value) => `${value}/100`} />
              <Bar dataKey="risk" radius={[0, 8, 8, 0]} fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
