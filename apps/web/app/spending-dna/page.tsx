import type { DashboardPeriod } from "@fintwin/shared";
import type { ReactNode } from "react";
import { ArrowUpRight, Brain, CalendarDays, CheckCircle2, Shield, WalletCards, Zap } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { SpendingDnaDetailPanel } from "../../components/insight-detail-panels";
import { getSpendingDna } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

type SpendingDnaPageProps = {
  searchParams?: Promise<{ period?: string }>;
};

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "daily", label: "Günlük" },
  { value: "weekly", label: "Haftalık" },
  { value: "monthly", label: "Aylık" },
  { value: "yearly", label: "Yıllık" }
];

export default async function SpendingDnaPage({ searchParams }: SpendingDnaPageProps) {
  const { token, user } = await requirePersonalSession();
  const params = await searchParams;
  const period = parsePeriod(params?.period);
  const dna = await getSpendingDna({ token, period });
  const topCategory = [...dna.categories].sort((left, right) => right.monthlySpend - left.monthlySpend)[0];

  return (
    <AppShell active="/spending-dna" accountType="personal" displayName={user.name}>
      <section className="image-page analysis-image-page">
        <header className="image-page-header">
          <div>
            <h1>Analiz</h1>
            <p>Finansal kalıplarınızı anlayın, daha iyi kararlar alın.</p>
          </div>
        </header>

        <nav className="image-tabs" aria-label="Analiz sekmeleri">
          <a className="active" href="/spending-dna">Spending DNA</a>
          <a href="/categories">Kategori Dağılımı</a>
          <a href="/what-if">What-if Senaryolar</a>
          <a href="/emotional-delay">Duygusal Gecikme</a>
        </nav>

        <div className="image-kpi-grid five">
          <ImageKpi icon={<WalletCards size={25} />} label="Aylık Harcama" value={formatTry(totalMonthlySpend(dna))} trend="%8,2 geçen aya göre" />
          <ImageKpi icon={<Brain size={25} />} label="Tasarruf Oranı" value={`%${dna.savingDiscipline}`} trend="%3,1 geçen aya göre" />
          <ImageKpi icon={<Shield size={25} />} label="En Çok Harcama" value={topCategory?.categoryName ?? "Veri yok"} trend={topCategory ? `${formatTry(topCategory.monthlySpend)} harcandı` : "Kategori bekleniyor"} />
          <ImageKpi icon={<Zap size={25} />} label="Ani Harcama Skoru" value={`${dna.campaignSensitivity}/100`} tone="warning" trend="Yüksek risk" />
          <ImageKpi icon={<CheckCircle2 size={25} />} label="Finansal Disiplin" value={dna.savingDiscipline >= 60 ? "İyi" : "Dikkat"} trend="Trend pozitif" />
        </div>

        <div className="analysis-reference-grid">
          <main className="analysis-reference-main">
            <SpendingDnaDetailPanel dna={dna} />
          </main>

          <aside className="analysis-reference-rail">
            <section className="panel image-actions-card">
              <div className="section-title">
                <span>Riskle Eşleşen Aksiyonlar</span>
                <strong>3</strong>
              </div>
              {[
                {
                  title: topCategory ? `${topCategory.categoryName} harcamasını sınırla` : "Kategori limitlerini tamamla",
                  detail: topCategory ? `${formatTry(topCategory.monthlySpend)} harcama bu dönemin ana sinyali.` : "Riskleri netleştirmek için kategori bütçesi ekle."
                },
                { title: "Abonelikleri kontrol et", detail: "Tekrar eden ödemeler risk skorunu gereksiz yükseltebilir." },
                { title: "What-if ile karar al", detail: "Büyük harcamayı önce bütçe etkisiyle karşılaştır." }
              ].map((item) => (
                <a href="/actions" key={item.title}>
                  <ArrowUpRight size={18} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </a>
              ))}
            </section>
            <section className="panel image-calendar-card">
              <div className="section-title">
                <span>Harcama Takvimi</span>
                <CalendarDays size={18} />
              </div>
              <p className="calendar-context">Seçili gün, harcama yoğunluğunun en belirgin olduğu günü gösterir.</p>
              <div className="mini-calendar-grid">
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24"].map((day) => (
                  <span className={day === "14" ? "active" : ""} key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-bar-head">
                <span>14 Mayıs saatlik dağılım</span>
                <strong>{formatTry(topCategory?.monthlySpend ?? 0)}</strong>
              </div>
              <div className="calendar-bars">
                {Array.from({ length: 24 }, (_, index) => (
                  <span style={{ height: `${18 + ((index * 13) % 54)}px` }} key={index} />
                ))}
              </div>
            </section>
            <section className="panel image-source-card">
              <span className="status-dot" />
              Son veri senkronizasyonu: 14.05.2026 11:32
            </section>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}

function PeriodTabs({ active }: { active: DashboardPeriod }) {
  return (
    <nav className="period-tabs" aria-label="Spending DNA dönemi">
      {periodOptions.map((option) => (
        <a className={option.value === active ? "active" : ""} href={`/spending-dna?period=${option.value}`} key={option.value}>
          {option.label}
        </a>
      ))}
    </nav>
  );
}

function parsePeriod(value: string | undefined): DashboardPeriod {
  return periodOptions.some((option) => option.value === value) ? (value as DashboardPeriod) : "monthly";
}

function ImageKpi({
  icon,
  label,
  tone,
  trend,
  value
}: {
  icon: ReactNode;
  label: string;
  tone?: "warning";
  trend: string;
  value: string;
}) {
  return (
    <article className={tone ? `image-kpi ${tone}` : "image-kpi"}>
      {icon}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>
          <ArrowUpRight size={13} />
          {trend}
        </small>
      </div>
    </article>
  );
}

function totalMonthlySpend(dna: { categories: Array<{ monthlySpend: number }> }) {
  return dna.categories.reduce((sum, category) => sum + category.monthlySpend, 0);
}

function formatTry(value: number) {
  return `₺${Math.round(value).toLocaleString("tr-TR")}`;
}
