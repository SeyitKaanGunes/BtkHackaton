"use client";

import { type CSSProperties, type FormEvent, type ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRightLeft, Bot, Building2, CalendarPlus, CheckCircle2, CircleDollarSign, Clock3, Fingerprint, Landmark, MessageSquareText, Send, ShieldAlert, Sparkles, TrendingUp, UserPlus } from "lucide-react";
import {
  buildBusinessInsights,
  parseAmountFromText,
  type AiCfoSimulation,
  type Business,
  type BusinessDna,
  type BusinessDnaFactor,
  type BusinessCashflowPoint,
  type BusinessCoverageAnalysis,
  type BusinessCustomer,
  type BusinessDashboard,
  type BusinessInsights,
  type BusinessScenarioAnalysis,
  type BusinessSummaryInsight,
  type CollectionPriority,
  type CollectionScore
} from "@fintwin/shared";
import { createBusiness, createBusinessCashEvent, createBusinessCustomer, simulateBusinessDecision } from "../lib/api";
import { formatCurrency } from "../lib/format";

export type BusinessWorkspaceData = {
  business: Business;
  dashboard: BusinessDashboard;
  customers: BusinessCustomer[];
  scores: CollectionScore[];
};

type Status = { tone: "ok" | "error"; text: string } | null;
type DetailFact = { label: string; value: string; tone?: "positive" | "negative" | "warning" };
export type BusinessSectionId = "twin" | "dna" | "cashflow" | "coverage" | "collections" | "scenarios" | "records" | "assistant";

const businessSectionLinks: Array<{ href: string; id: BusinessSectionId | "overview"; label: string }> = [
  { href: "/business", id: "overview", label: "Genel bakış" },
  { href: "/business?section=twin", id: "twin", label: "Finansal ikiz" },
  { href: "/business?section=cashflow", id: "cashflow", label: "Nakit akışı" },
  { href: "/business?section=coverage", id: "coverage", label: "Maaş ve kira" },
  { href: "/business?section=collections", id: "collections", label: "Tahsilat" },
  { href: "/business?section=scenarios", id: "scenarios", label: "Senaryolar" },
  { href: "/business?section=records", id: "records", label: "Kayıtlar" },
  { href: "/business?section=assistant", id: "assistant", label: "KOBİ asistanı" }
];

export function BusinessWorkspace({
  initialData,
  activeSection = "twin",
  showOverview = true
}: {
  initialData: BusinessWorkspaceData | null;
  activeSection?: BusinessSectionId;
  showOverview?: boolean;
}) {
  if (!initialData) return <BusinessOnboarding />;
  return <BusinessDashboardView data={initialData} activeSection={activeSection} showOverview={showOverview} />;
}

function BusinessOnboarding() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [cashBalance, setCashBalance] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await createBusiness({
        name: name.trim(),
        sector: sector.trim(),
        cashBalance: parseOptionalMoney(cashBalance, "Başlangıç kasa bakiyesi")
      });
      setStatus({ tone: "ok", text: "İşletme oluşturuldu." });
      router.refresh();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "İşletme oluşturulamadı." });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Ayrı KOBİ Modülü</p>
          <h1>KOBİ profili oluştur.</h1>
          <p className="header-subtitle">Bu hesapta işletme kaydı yok. Başlangıç bilgilerini girince KOBİ alanı işletme verilerinizle açılacak.</p>
        </div>
        <div className="health-score">
          <Building2 size={22} />
          <span>Kurulum</span>
          <strong>Veri</strong>
        </div>
      </header>

      <section className="panel business-form-panel">
        <div className="section-title">
          <span>İşletme onboarding</span>
          <strong>Yeni kayıt</strong>
        </div>
        <form className="business-form" onSubmit={submit}>
          <label className="field">
            <span>İşletme adı</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} placeholder="Fintwin Studio" />
          </label>
          <label className="field">
            <span>Sektör</span>
            <input value={sector} onChange={(event) => setSector(event.target.value)} required minLength={2} placeholder="SaaS, perakende, lojistik" />
          </label>
          <label className="field">
            <span>Başlangıç kasa bakiyesi</span>
            <input value={cashBalance} onChange={(event) => setCashBalance(event.target.value)} inputMode="decimal" placeholder="250000" />
          </label>
          <button className="secondary-button" type="submit" disabled={pending}>
            {pending ? "Oluşturuluyor" : "İşletme oluştur"}
          </button>
        </form>
        {status ? <p className={`form-message ${status.tone === "error" ? "danger" : ""}`}>{status.text}</p> : null}
      </section>
    </>
  );
}

function BusinessDashboardView({ data, activeSection, showOverview }: { data: BusinessWorkspaceData; activeSection: BusinessSectionId; showOverview: boolean }) {
  const { business, dashboard, customers, scores } = data;
  const insights = buildBusinessInsights(business, [...dashboard.upcomingPayments, ...dashboard.expectedCollections], customers, scores);
  return (
    <>
      {showOverview ? (
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Ayrı KOBİ Modülü</p>
            <h1>{business.name}</h1>
            <p className="header-subtitle">{business.sector} işletme metrikleri bu işletme hesabındaki güncel kayıtlardan okunur.</p>
          </div>
        </header>
      ) : null}

      {showOverview ? <BusinessOverviewCockpit businessId={business.id} customers={customers} dashboard={dashboard} insights={insights} scores={scores} /> : null}
      {!showOverview ? (
        <>
          <BusinessSectionNav activeSection={activeSection} showOverview={showOverview} />
          <BusinessSectionContent
            activeSection={activeSection}
            businessId={business.id}
            customers={customers}
            dashboard={dashboard}
            detail
            insights={insights}
            scores={scores}
          />
        </>
      ) : null}
    </>
  );
}

function BusinessSectionNav({ activeSection, showOverview }: { activeSection: BusinessSectionId; showOverview: boolean }) {
  return (
    <nav className="business-section-nav" aria-label="KOBİ modülleri">
      {businessSectionLinks.map((item) => {
        const active = showOverview ? item.id === "overview" : item.id === activeSection;
        return (
          <Link className={active ? "active" : ""} href={item.href} key={item.id}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function BusinessSectionContent({
  activeSection,
  businessId,
  customers,
  dashboard,
  detail,
  insights,
  scores
}: {
  activeSection: BusinessSectionId;
  businessId: string;
  customers: BusinessCustomer[];
  dashboard: BusinessDashboard;
  detail: boolean;
  insights: BusinessInsights;
  scores: CollectionScore[];
}) {
  return (
    <section className={detail ? "business-section-content detail-mode" : "business-section-content"}>
      {activeSection === "twin" ? <TwinInsightPanel detail={detail} insights={insights} /> : null}
      {activeSection === "dna" ? <BusinessDnaPanel detail={detail} dna={insights.businessDna} /> : null}
      {activeSection === "cashflow" ? <CashflowForecastPanel detail={detail} points={insights.cashflow} /> : null}
      {activeSection === "coverage" ? <CoveragePanel coverage={insights.coverage} detail={detail} /> : null}
      {activeSection === "collections" ? <CollectionPriorityPanel detail={detail} priorities={insights.collectionPriorities} /> : null}
      {activeSection === "scenarios" ? <ScenarioSimulatorPanel businessId={businessId} detail={detail} scenarios={insights.scenarios} /> : null}
      {activeSection === "assistant" ? <BusinessAssistantPanel dashboard={dashboard} detail={detail} insights={insights} /> : null}
      {activeSection === "records" ? (
        <>
          {detail ? <RecordsOverviewPanel customers={customers} dashboard={dashboard} scores={scores} /> : null}
          <section className="split-layout business-data-entry">
            <CashEventsPanel businessId={businessId} dashboard={dashboard} />
            <CustomersPanel businessId={businessId} customers={customers} scores={scores} />
          </section>
        </>
      ) : null}
    </section>
  );
}

function BusinessSummaryMetrics({ summary }: { summary: BusinessSummaryInsight }) {
  return (
    <section className="metric-grid business-summary-grid">
      <Metric icon={<Landmark size={20} />} label="Kasa" value={formatTry(summary.cashBalance)} />
      <Metric icon={<CircleDollarSign size={20} />} label="Beklenen tahsilat" value={formatTry(summary.expectedCollections30Days)} />
      <Metric icon={<Clock3 size={20} />} label="Yaklaşan ödeme" value={formatTry(summary.upcomingPayments30Days)} />
      <Metric icon={<AlertTriangle size={20} />} label="Geciken alacak" value={formatTry(summary.overdueReceivables)} />
      <Metric icon={<TrendingUp size={20} />} label="30 gün sonu" value={formatTry(summary.projected30Days)} />
      <Metric icon={<ShieldAlert size={20} />} label="Nakit risk skoru" value={`${summary.cashRiskScore}/100`} />
    </section>
  );
}

function BusinessOverviewCockpit({
  businessId,
  customers,
  dashboard,
  insights,
  scores
}: {
  businessId: string;
  customers: BusinessCustomer[];
  dashboard: BusinessDashboard;
  insights: BusinessInsights;
  scores: CollectionScore[];
}) {
  return (
    <section className="dashboard-reference-layout business-dashboard-reference-layout">
      <div className="dashboard-reference-main business-reference-main">
        <BusinessSectionNav activeSection="twin" showOverview />
        <BusinessSummaryMetrics summary={insights.summary} />
        <CashflowForecastPanel detail={false} points={insights.cashflow} />
        <section className="dashboard-lower-grid business-dashboard-lower-grid">
          <CollectionPriorityPanel detail={false} priorities={insights.collectionPriorities} />
          <ScenarioSimulatorPanel businessId={businessId} detail={false} scenarios={insights.scenarios} />
        </section>
        <section className="split-layout business-data-entry business-overview-records">
          <CashEventsPanel businessId={businessId} dashboard={dashboard} />
          <CustomersPanel businessId={businessId} customers={customers} scores={scores} />
        </section>
      </div>
      <aside className="dashboard-reference-rail business-reference-rail">
        <BusinessRiskCard customers={customers} dashboard={dashboard} insights={insights} />
        <BusinessQuickActionsPanel />
        <CoveragePanel coverage={insights.coverage} detail={false} />
        <BusinessAssistantPanel dashboard={dashboard} detail={false} insights={insights} />
      </aside>
    </section>
  );
}

function BusinessRiskCard({ customers, dashboard, insights }: { customers: BusinessCustomer[]; dashboard: BusinessDashboard; insights: BusinessInsights }) {
  const cashEventCount = dashboard.upcomingPayments.length + dashboard.expectedCollections.length;
  const criticalDate = insights.twin.criticalDates[0];
  return (
    <section className="health-card panel business-risk-card">
      <div className="score-ring" style={{ "--score": insights.summary.cashRiskScore } as CSSProperties}>
        <strong>{insights.summary.cashRiskScore}</strong>
        <span>/100</span>
        <small>risk</small>
      </div>
      <div>
        <p className="eyebrow muted">Nakit Sağlığı</p>
        <h2>{riskLabel(insights.summary.riskLevel)}</h2>
        <p>
          {criticalDate
            ? `${formatDateLabel(criticalDate.date)} kritik gün olarak izleniyor; tahmini bakiye ${formatTry(criticalDate.projectedBalance)}.`
            : `${cashEventCount} nakit olayı ve ${customers.length} müşteri kaydı ile KOBİ ikizi izleniyor.`}
        </p>
        <div className="chip-row">
          <span className="chip warn">{riskLabel(dashboard.liquidityRisk)} likidite</span>
          <span className="chip accent">{cashEventCount} nakit olayı</span>
        </div>
      </div>
    </section>
  );
}

function BusinessQuickActionsPanel() {
  return (
    <section className="panel quick-action-panel business-quick-action-panel">
      <div className="section-title">
        <span>Hızlı KOBİ işlemleri</span>
        <strong>4</strong>
      </div>
      <Link href="/business?section=records">
        <CalendarPlus size={16} />
        Nakit / müşteri kaydı
      </Link>
      <Link href="/business?section=scenarios">
        <ArrowRightLeft size={16} />
        Senaryo çalıştır
      </Link>
      <Link href="/business?section=collections">
        <UserPlus size={16} />
        Tahsilatı izle
      </Link>
      <Link href="/business?section=assistant">
        <Bot size={16} />
        KOBİ asistanına sor
      </Link>
    </section>
  );
}

function TwinInsightPanel({ detail, insights }: { detail: boolean; insights: BusinessInsights }) {
  const nextCriticalDate = insights.twin.criticalDates[0];
  const detailFacts: DetailFact[] = [
    { label: "Risk seviyesi", value: riskLabel(insights.summary.riskLevel), tone: riskFactTone(insights.summary.riskLevel) },
    { label: "Risk skoru", value: `${insights.summary.cashRiskScore}/100` },
    { label: "En düşük bakiye", value: formatTry(insights.summary.lowestProjectedBalance30Days) },
    { label: "Kritik gün", value: nextCriticalDate ? formatDateLabel(nextCriticalDate.date) : "Görünmüyor" }
  ];

  return (
    <section className={detail ? "panel business-twin-panel detail-panel" : "panel business-twin-panel"}>
      {detail ? (
        <BusinessSectionIntro
          description={insights.twin.summary}
          eyebrow="Finansal İkiz"
          facts={detailFacts}
          title="İşletmenin kısa vadeli finansal davranışı"
        />
      ) : (
        <div className="business-twin-copy">
          <Sparkles size={20} />
          <div>
            <p className="eyebrow">Finansal İkiz Cevabı</p>
            <h2>{insights.twin.summary}</h2>
          </div>
        </div>
      )}
      <div className={detail ? "critical-date-list detailed" : "critical-date-list"}>
        {insights.twin.criticalDates.map((item) => (
          <div className={`critical-date ${riskToneClass(item.riskLevel)}`} key={`${item.date}-${item.label}`}>
            <span>{formatDateLabel(item.date)}</span>
            <strong>{item.label}</strong>
            <small>{formatTry(item.projectedBalance)} tahmini bakiye</small>
          </div>
        ))}
      </div>
      {detail ? (
        <div className="business-detail-grid">
          <DetailBlock title="Veri durumu">
            {insights.missingData.length > 0 ? (
              insights.missingData.map((item) => <DetailRow key={item} label="Eksik veri" value={item} />)
            ) : (
              <DetailRow label="Eksik veri" value="Kayıtlı veriyle analiz üretilebiliyor." />
            )}
            {insights.assumptions.map((item) => <DetailRow key={item} label="Varsayım" value={item} />)}
          </DetailBlock>
          <DetailBlock title="Aksiyon yönü">
            <DetailRow label="Sonuç" value={twinResultText(insights)} />
            <DetailRow label="Öneri" value={twinActionText(insights)} />
          </DetailBlock>
        </div>
      ) : insights.missingData.length > 0 || insights.assumptions.length > 0 ? (
        <div className="business-note-strip">
          {insights.missingData.slice(0, 2).map((item) => (
            <span key={item}>{item}</span>
          ))}
          {insights.assumptions.slice(0, 1).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BusinessDnaPanel({ detail, dna }: { detail: boolean; dna: BusinessDna }) {
  const topFactor = [...dna.factors].sort((left, right) => right.score - left.score)[0];
  const detailFacts: DetailFact[] = [
    { label: "Genel risk", value: `${dna.overallRisk}/100`, tone: riskFactTone(riskFromScoreValue(dna.overallRisk)) },
    { label: "Veri güveni", value: dataConfidenceLabel(dna.dataConfidenceLevel) },
    { label: "Ana sinyal", value: topFactor?.label ?? "Veri yok", tone: topFactor ? riskFactTone(topFactor.riskLevel) : undefined },
    { label: "Eksik veri", value: `${dna.missingData.length}` }
  ];

  return (
    <section className={detail ? "panel business-dna-panel detail-panel" : "panel business-dna-panel"}>
      {detail ? (
        <BusinessSectionIntro
          description="İşletme DNA; nakit tamponu, ödeme baskısı, tahsilat güvenilirliği ve zorunlu ödeme dayanıklılığını KOBİ verilerinden deterministik olarak okur."
          eyebrow="İşletme DNA"
          facts={detailFacts}
          title="Nakit davranışı ve operasyon refleksi"
        />
      ) : (
        <div className="section-title">
          <span>İşletme DNA</span>
          <strong>{dna.overallRisk}/100 risk</strong>
        </div>
      )}

      <div className="business-dna-overview">
        <div className="score-ring" style={{ "--score": dna.overallRisk } as CSSProperties}>
          <strong>{dna.overallRisk}</strong>
          <span>/100</span>
          <small>risk</small>
        </div>
        <div className="business-dna-patterns">
          <div className="business-dna-headline">
            <Fingerprint size={20} />
            <div>
              <span>{dataConfidenceLabel(dna.dataConfidenceLevel)} veri güveni</span>
              <strong>{topFactor ? `${topFactor.label} öne çıkıyor` : "Veri sinyali bekleniyor"}</strong>
            </div>
          </div>
          {dna.patterns.map((pattern) => (
            <p key={pattern}>{pattern}</p>
          ))}
        </div>
      </div>

      <div className="business-dna-factor-grid">
        {dna.factors.map((factor) => (
          <BusinessDnaFactorCard factor={factor} key={factor.id} />
        ))}
      </div>

      {detail ? (
        <div className="business-detail-grid">
          <DetailBlock title="Veri durumu">
            <DetailRow label="Veri güveni" value={`${dataConfidenceLabel(dna.dataConfidenceLevel)} (${Math.round(dna.dataConfidence * 100)}/100)`} />
            {dna.missingData.length > 0 ? (
              dna.missingData.map((item) => <DetailRow key={item} label="Eksik veri" value={item} />)
            ) : (
              <DetailRow label="Eksik veri" value="İşletme DNA için temel nakit ve tahsilat verisi mevcut." />
            )}
            {dna.assumptions.map((item) => <DetailRow key={item} label="Varsayım" value={item} />)}
          </DetailBlock>
          <DetailBlock title="Aksiyon yönü">
            {dna.factors.slice(0, 3).map((factor) => (
              <DetailRow key={`${factor.id}-action`} label={factor.label} value={factor.action} />
            ))}
          </DetailBlock>
        </div>
      ) : null}
    </section>
  );
}

function BusinessDnaFactorCard({ factor }: { factor: BusinessDnaFactor }) {
  return (
    <div className={`business-dna-factor-card ${riskToneClass(factor.riskLevel)}`}>
      <div>
        <span>{factor.label}</span>
        <strong>{factor.score}/100</strong>
      </div>
      <p>{factor.value}</p>
      {factor.benchmark ? <small>{factor.benchmark}</small> : null}
      <em>{factor.reasons[0]}</em>
    </div>
  );
}

function CashflowForecastPanel({ detail, points }: { detail: boolean; points: BusinessCashflowPoint[] }) {
  const balances = points.map((point) => point.balance);
  const minBalance = Math.min(0, ...balances);
  const maxBalance = Math.max(1, ...balances);
  const range = Math.max(maxBalance - minBalance, 1);
  const eventfulPoints = points.filter((point) => point.inflow > 0 || point.outflow > 0 || point.riskLevel === "high" || point.riskLevel === "critical");
  const visibleEventPoints = detail ? eventfulPoints : eventfulPoints.slice(0, 4);
  const riskyPoints = points.filter((point) => point.riskLevel === "high" || point.riskLevel === "critical");
  const lowestPoint = lowestCashflowPoint(points);
  const totalInflow = sumNumbers(points.map((point) => point.inflow));
  const totalOutflow = sumNumbers(points.map((point) => point.outflow));
  const endingPoint = points[points.length - 1];
  const detailFacts: DetailFact[] = [
    { label: "30 gün sonu", value: formatTry(endingPoint?.balance ?? 0) },
    { label: "En düşük bakiye", value: lowestPoint ? formatTry(lowestPoint.balance) : "Veri yok", tone: lowestPoint ? riskFactTone(lowestPoint.riskLevel) : undefined },
    { label: "Tahsilat", value: formatTry(totalInflow), tone: "positive" },
    { label: "Ödeme", value: formatTry(totalOutflow), tone: "negative" }
  ];

  return (
    <section className={detail ? "panel cashflow-forecast-panel detail-panel" : "panel cashflow-forecast-panel"}>
      {detail ? (
        <BusinessSectionIntro
          description="Gelecek 30 gün için tahsilat ve ödeme takviminden hesaplanan nakit bakiyesi tahmini."
          eyebrow="Nakit Akışı"
          facts={detailFacts}
          title="Riskli günleri ve nakit hareketlerini birlikte izle"
        />
      ) : (
        <div className="section-title">
          <span>30 günlük nakit akışı</span>
          <strong>{points.length} gün</strong>
        </div>
      )}
      <div className="cashflow-chart" aria-label="30 günlük tahmini nakit akışı">
        {points.map((point, index) => {
          const height = Math.max(8, ((point.balance - minBalance) / range) * 100);
          return (
            <div className="cashflow-bar-wrap" key={point.date}>
              <span className={`cashflow-bar ${riskToneClass(point.riskLevel)}`} style={{ "--bar-height": `${height}%` } as CSSProperties} title={`${point.label}: ${formatTry(point.balance)}`} />
              {index % 7 === 0 || index === points.length - 1 ? <small>{point.label}</small> : null}
            </div>
          );
        })}
      </div>
      <div className="cashflow-events">
        {visibleEventPoints.length > 0 ? (
          visibleEventPoints.map((point) => (
            <div className="cashflow-event" key={`${point.date}-${point.balance}`}>
              <span>{formatDateLabel(point.date)}</span>
              <strong>{formatTry(point.balance)}</strong>
              <small>{point.eventTitles.join(", ") || riskLabel(point.riskLevel)}</small>
            </div>
          ))
        ) : (
          <div className="empty-state">Grafik için gelecek tahsilat veya ödeme bekleniyor.</div>
        )}
      </div>
      {detail ? (
        <div className="business-detail-grid">
          <DetailBlock title="Riskli günler">
            {riskyPoints.length > 0 ? (
              riskyPoints.slice(0, 6).map((point) => (
                <DetailRow
                  key={`${point.date}-risk`}
                  label={formatDateLabel(point.date)}
                  value={`${formatTry(point.balance)} bakiye · ${point.eventTitles.join(", ") || riskLabel(point.riskLevel)}`}
                />
              ))
            ) : (
              <DetailRow label="Durum" value="Kayıtlı nakit olaylarına göre yüksek riskli gün görünmüyor." />
            )}
          </DetailBlock>
          <DetailBlock title="Nakit hareketi özeti">
            <DetailRow label="Toplam giriş" value={formatTry(totalInflow)} />
            <DetailRow label="Toplam çıkış" value={formatTry(totalOutflow)} />
            <DetailRow label="Net hareket" value={formatTry(totalInflow - totalOutflow)} />
            <DetailRow label="Riskli gün sayısı" value={`${riskyPoints.length} gün`} />
          </DetailBlock>
        </div>
      ) : null}
    </section>
  );
}

function CoveragePanel({ coverage, detail }: { coverage: BusinessCoverageAnalysis; detail: boolean }) {
  const statusIcon = coverage.canCover ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />;
  const detailFacts: DetailFact[] = [
    { label: "Sonuç", value: coverage.comfortLevel === "missing_data" ? "Veri bekleniyor" : coverage.canCover ? "Karşılanabilir" : "Riskli" },
    { label: "Maaş + kira", value: formatTry(coverage.requiredTotal) },
    { label: "En düşük bakiye", value: formatTry(coverage.lowestBalanceAfterRequired), tone: coverage.lowestBalanceAfterRequired < 0 ? "negative" : "positive" },
    { label: "Tampon açığı", value: formatTry(coverage.shortfall), tone: coverage.shortfall > 0 ? "warning" : "positive" }
  ];

  return (
    <section className={`panel coverage-panel ${coverage.comfortLevel} ${detail ? "detail-panel" : ""}`}>
      {detail ? (
        <BusinessSectionIntro
          description={coverage.explanation}
          eyebrow="Maaş ve Kira"
          facts={detailFacts}
          title="Zorunlu ödemeler için karar destek analizi"
        />
      ) : (
        <div className="section-title">
          <span>Maaş ve kira karşılanabilir mi?</span>
          <strong>{coverage.comfortLevel === "missing_data" ? "Veri bekleniyor" : coverage.canCover ? "Evet" : "Riskli"}</strong>
        </div>
      )}
      <div className="coverage-verdict">
        {statusIcon}
        <p>{coverage.explanation}</p>
      </div>
      <div className="coverage-grid">
        <MiniFact label="Maaş" value={formatTry(coverage.payrollTotal)} />
        <MiniFact label="Kira" value={formatTry(coverage.rentTotal)} />
        <MiniFact label="En düşük bakiye" value={formatTry(coverage.lowestBalanceAfterRequired)} />
        <MiniFact label="Tampon açığı" value={formatTry(coverage.shortfall)} />
      </div>
      {coverage.riskDate ? <p className="coverage-note">Risk tarihi: {formatDateLabel(coverage.riskDate)}</p> : null}
      {coverage.relievingCollection || coverage.deferrablePayment ? (
        <div className="coverage-actions">
          {coverage.relievingCollection ? <span>{coverage.relievingCollection.title} tahsilatı gelirse tampon güçlenir.</span> : null}
          {coverage.deferrablePayment ? <span>{coverage.deferrablePayment.title} ertelenirse risk azalır.</span> : null}
        </div>
      ) : null}
      {detail ? (
        <div className="scenario-decision-grid">
          <DetailRow label="Sonuç" value={coverageDecisionResult(coverage)} />
          <DetailRow label="Neden" value={coverage.explanation} />
          <DetailRow label="Varsayımlar" value="Yalnızca kayıtlı ve maaş/kira olarak etiketlenmiş ödeme olayları dikkate alındı." />
          <DetailRow label="Veri güveni" value={coverage.comfortLevel === "missing_data" ? "Düşük - maaş/kira etiketi yok." : "Orta - kayıtlı nakit olaylarına bağlı."} />
          <DetailRow label="Önerilen aksiyon" value={coverageActionText(coverage)} />
        </div>
      ) : null}
    </section>
  );
}

function CollectionPriorityPanel({ detail, priorities }: { detail: boolean; priorities: CollectionPriority[] }) {
  const visiblePriorities = detail ? priorities : priorities.slice(0, 3);
  const totalOutstanding = sumNumbers(priorities.map((priority) => priority.outstandingAmount));
  const highRiskCount = priorities.filter((priority) => priority.riskLevel === "high" || priority.riskLevel === "critical").length;
  const averageScore = priorities.length > 0 ? Math.round(sumNumbers(priorities.map((priority) => priority.score)) / priorities.length) : 0;
  const detailFacts: DetailFact[] = [
    { label: "Müşteri", value: `${priorities.length}` },
    { label: "Açık bakiye", value: formatTry(totalOutstanding) },
    { label: "Yüksek risk", value: `${highRiskCount}` },
    { label: "Ortalama skor", value: priorities.length > 0 ? `${averageScore}/100` : "Veri yok" }
  ];

  return (
    <section className={detail ? "panel collection-priority-panel detail-panel" : "panel collection-priority-panel"}>
      {detail ? (
        <BusinessSectionIntro
          description="Geciken fatura davranışı, açık bakiye ve tahsilat skoruna göre hangi müşteriye önce odaklanılacağını sıralar."
          eyebrow="Tahsilat"
          facts={detailFacts}
          title="Tahsilat önceliği ve kurtarma planı"
        />
      ) : (
        <div className="section-title">
          <span>Tahsilat önceliği</span>
          <strong>{priorities.length} müşteri</strong>
        </div>
      )}
      {visiblePriorities.length > 0 ? (
        <div className="priority-list">
          {visiblePriorities.map((priority) => (
            <div className={`priority-row ${riskToneClass(priority.riskLevel)}`} key={priority.customerId}>
              <div>
                <strong>{priority.customerName}</strong>
                <span>{priority.averageDelayDays} gün ortalama gecikme · güven skoru {priority.score}/100</span>
              </div>
              <b>{formatTry(priority.outstandingAmount)}</b>
              <small>{priority.action}</small>
              <p>
                <MessageSquareText size={15} />
                {priority.reminderMessage}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">Önceliklendirme için müşteri ve açık bakiye bekleniyor.</div>
      )}
      {detail ? (
        <DetailBlock title="Bu hafta tahsilat planı">
          {priorities.length > 0 ? (
            priorities.slice(0, 3).map((priority, index) => (
              <DetailRow key={`${priority.customerId}-plan`} label={`${index + 1}. aksiyon`} value={`${priority.customerName}: ${priority.action}`} />
            ))
          ) : (
            <DetailRow label="Plan" value="Plan üretmek için müşteri ve açık bakiye verisi bekleniyor." />
          )}
        </DetailBlock>
      ) : null}
    </section>
  );
}

function ScenarioSimulatorPanel({ businessId, detail, scenarios }: { businessId: string; detail: boolean; scenarios: BusinessScenarioAnalysis[] }) {
  const [selectedScenarioId, setSelectedScenarioId] = useState<BusinessScenarioAnalysis["id"]>(scenarios[0]?.id ?? "collection_delay");
  const [decision, setDecision] = useState("");
  const [amount, setAmount] = useState("");
  const [simulation, setSimulation] = useState<AiCfoSimulation | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0];
  const bestScenario = [...scenarios].sort((left, right) => right.cashImpact - left.cashImpact)[0];
  const worstScenario = [...scenarios].sort((left, right) => left.cashImpact - right.cashImpact)[0];
  const detailFacts: DetailFact[] = [
    { label: "Senaryo", value: `${scenarios.length}` },
    { label: "En güçlü etki", value: bestScenario ? formatTry(bestScenario.cashImpact) : "Veri yok", tone: bestScenario && bestScenario.cashImpact >= 0 ? "positive" : "negative" },
    { label: "En zayıf etki", value: worstScenario ? formatTry(worstScenario.cashImpact) : "Veri yok", tone: worstScenario && worstScenario.cashImpact < 0 ? "warning" : "positive" },
    { label: "Seçili risk", value: selectedScenario ? riskLabel(selectedScenario.riskLevel) : "Veri yok" }
  ];

  async function submitCustomScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDecision = decision.trim();
    setPending(true);
    setStatus(null);
    try {
      if (!trimmedDecision) throw new Error("Karar açıklaması zorunlu.");
      const result = await simulateBusinessDecision(businessId, {
        amount: parseRequiredMoney(amount, "Tutar"),
        decision: trimmedDecision
      });
      setSimulation(result);
      setStatus({ tone: "ok", text: "Özel senaryo hesaplandı." });
    } catch (error) {
      setSimulation(null);
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Özel senaryo hesaplanamadı." });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={detail ? "panel business-scenario-panel detail-panel" : "panel business-scenario-panel"}>
      {detail ? (
        <BusinessSectionIntro
          description="Seçili varsayımın 30 gün sonu kasa etkisini mevcut nakit akışıyla karşılaştırır."
          eyebrow="Senaryolar"
          facts={detailFacts}
          title="What-if senaryo simülatörü"
        />
      ) : (
        <div className="section-title">
          <span>Mini senaryo simülatörü</span>
          <strong>3 hazır senaryo</strong>
        </div>
      )}
      <div className="scenario-tabs" role="tablist" aria-label="KOBİ senaryoları">
        {scenarios.map((scenario) => (
          <button className={scenario.id === selectedScenario?.id ? "active" : ""} key={scenario.id} type="button" onClick={() => setSelectedScenarioId(scenario.id)}>
            {scenario.label}
          </button>
        ))}
      </div>
      {selectedScenario ? (
        <div className={`scenario-result ${riskToneClass(selectedScenario.riskLevel)}`}>
          <ArrowRightLeft size={20} />
          <div>
            <strong>{formatTry(selectedScenario.projected30Days)}</strong>
            <span>{selectedScenario.description}</span>
            <p>{selectedScenario.recommendation}</p>
          </div>
          <b>{selectedScenario.cashImpact >= 0 ? "+" : ""}{formatTry(selectedScenario.cashImpact)}</b>
        </div>
      ) : (
        <div className="empty-state">Senaryo için nakit verisi bekleniyor.</div>
      )}
      <form className="business-form compact scenario-custom-form" onSubmit={submitCustomScenario}>
        <label className="field">
          <span>Karar</span>
          <input value={decision} onChange={(event) => setDecision(event.target.value)} required minLength={2} placeholder="Espresso makinesi alımı" />
        </label>
        <label className="field">
          <span>Tutar (₺)</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} required inputMode="decimal" placeholder="65000" />
        </label>
        <button className="secondary-button" type="submit" disabled={pending}>
          <ArrowRightLeft size={16} />
          {pending ? "Hesaplanıyor" : "Özel senaryoyu çalıştır"}
        </button>
      </form>
      {status ? <p className={`form-message ${status.tone === "error" ? "danger" : ""}`}>{status.text}</p> : null}
      {simulation ? (
        <div className={`custom-scenario-result ${riskToneClass(simulation.riskLevel)}`}>
          <div className="scenario-result custom-scenario-summary">
            <ArrowRightLeft size={20} />
            <div>
              <strong>{simulation.summary}</strong>
              <span>{simulation.reason}</span>
              {simulation.evidence.length > 0 ? (
                <p>{simulation.evidence.map((item) => `${item.label}: ${item.value}`).join(" · ")}</p>
              ) : null}
            </div>
            <b>{simulation.cashImpact >= 0 ? "+" : ""}{formatTry(simulation.cashImpact)}</b>
          </div>
          <div className="scenario-decision-grid">
            <DetailRow label="Sonuç" value={simulation.summary} />
            <DetailRow label="Neden" value={simulation.reason} />
            <DetailRow label="Varsayımlar" value={simulationAssumptionText(simulation)} />
            <DetailRow label="Veri güveni" value={simulationConfidenceText(simulation)} />
            {simulation.missingData.length > 0 ? <DetailRow label="Eksik veri" value={simulation.missingData.join(" ")} /> : null}
            <DetailRow label="Önerilen aksiyon" value={simulation.recommendedPlan} />
          </div>
        </div>
      ) : null}
      {detail && selectedScenario ? (
        <>
          <div className="scenario-decision-grid">
            <DetailRow label="Sonuç" value={`30 gün sonu tahmini kasa ${formatTry(selectedScenario.projected30Days)}.`} />
            <DetailRow label="Neden" value={selectedScenario.description} />
            <DetailRow label="Varsayımlar" value={scenarioAssumptionText(selectedScenario)} />
            <DetailRow label="Veri güveni" value={scenarioConfidenceText(selectedScenario)} />
            <DetailRow label="Önerilen aksiyon" value={selectedScenario.recommendation} />
          </div>
          <div className="scenario-comparison-grid">
            {scenarios.map((scenario) => (
              <button
                className={scenario.id === selectedScenario.id ? "scenario-compare-card active" : "scenario-compare-card"}
                key={`${scenario.id}-comparison`}
                type="button"
                onClick={() => setSelectedScenarioId(scenario.id)}
              >
                <span>{scenario.label}</span>
                <strong>{scenario.cashImpact >= 0 ? "+" : ""}{formatTry(scenario.cashImpact)}</strong>
                <small>{riskLabel(scenario.riskLevel)} risk · {formatTry(scenario.projected30Days)} kasa</small>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

type BusinessAssistantPromptId = "coverage" | "risk" | "collections" | "critical";

const businessAssistantPrompts: Array<{ id: BusinessAssistantPromptId; label: string }> = [
  { id: "coverage", label: "Maaş ve kirayı karşılayabilir miyim?" },
  { id: "risk", label: "Nakit sıkışıklığı yaşayacak mıyım?" },
  { id: "collections", label: "Hangi tahsilat daha kritik?" },
  { id: "critical", label: "Önümüzdeki kritik günler neler?" }
];

function BusinessAssistantPanel({ dashboard, detail, insights }: { dashboard: BusinessDashboard; detail: boolean; insights: BusinessInsights }) {
  const [selectedPrompt, setSelectedPrompt] = useState<BusinessAssistantPromptId>("coverage");
  const [question, setQuestion] = useState("");
  const [customQuestion, setCustomQuestion] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<BusinessAssistantPromptId | null>(null);
  const activePrompt = customPrompt ?? selectedPrompt;
  const answer = businessAssistantAnswer(activePrompt, dashboard, insights, customQuestion ?? undefined);
  const activeQuestionLabel = customQuestion ?? businessAssistantPrompts.find((prompt) => prompt.id === selectedPrompt)?.label ?? "KOBİ sorusu";
  const criticalDate = insights.twin.criticalDates[0];
  const facts: DetailFact[] = [
    { label: "Risk skoru", value: `${insights.summary.cashRiskScore}/100`, tone: riskFactTone(insights.summary.riskLevel) },
    { label: "30 gün sonu", value: formatTry(insights.summary.projected30Days), tone: insights.summary.projected30Days >= 0 ? "positive" : "negative" },
    { label: "Tahsilat", value: formatTry(insights.summary.expectedCollections30Days), tone: "positive" },
    { label: "Kritik gün", value: criticalDate ? formatDateLabel(criticalDate.date) : "Görünmüyor" }
  ];

  function selectPrompt(prompt: BusinessAssistantPromptId) {
    setSelectedPrompt(prompt);
    setCustomPrompt(null);
    setCustomQuestion(null);
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setCustomQuestion(trimmedQuestion);
    setCustomPrompt(inferBusinessAssistantPrompt(trimmedQuestion));
    setQuestion("");
  }

  return (
    <section className={detail ? "panel business-assistant-panel detail-panel" : "panel business-assistant-panel"}>
      {detail ? (
        <BusinessSectionIntro
          description="Bay Yengeç, KOBİ nakit akışını okur ve tahsilat/ödeme bilgilerine göre karar destek cevabı verir."
          eyebrow="KOBİ Asistanı"
          facts={facts}
          title="İşletme sorularını hızlıca yanıtla"
        />
      ) : (
        <div className="section-title">
          <span>KOBİ asistanı</span>
          <strong>Bay Yengeç</strong>
        </div>
      )}

      {detail ? (
        <div className="business-assistant-shell">
          <div className="business-assistant-picker">
            <div className="business-assistant-avatar">
              <span className="agent-pet" aria-hidden="true" />
              <div>
                <strong>Bay Yengeç</strong>
                <span>Veriye dayalı KOBİ cevabı</span>
              </div>
            </div>
            {businessAssistantPrompts.map((prompt) => (
              <button className={!customPrompt && prompt.id === selectedPrompt ? "business-assistant-question active" : "business-assistant-question"} key={prompt.id} type="button" onClick={() => selectPrompt(prompt.id)}>
                <MessageSquareText size={17} />
                <span>{prompt.label}</span>
              </button>
            ))}
            <form className="business-assistant-freeform" onSubmit={submitQuestion}>
              <label className="field">
                <span>Serbest soru</span>
                <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Nakit sıkışır mı?" />
              </label>
              <button className="secondary-button" type="submit">
                <Send size={16} />
                Sor
              </button>
            </form>
          </div>

          <div className="business-assistant-answer">
            <div className="business-assistant-answer-head">
              <Bot size={20} />
              <div>
                <span>{activeQuestionLabel}</span>
                <strong>{answer.result}</strong>
              </div>
            </div>
            <div className="scenario-decision-grid">
              <DetailRow label="Sonuç" value={answer.result} />
              <DetailRow label="Neden" value={answer.reason} />
              <DetailRow label="Soru odağı" value={answer.focus} />
              <DetailRow label="Varsayımlar" value={answer.assumptions} />
              <DetailRow label="Veri güveni" value={answer.confidence} />
              {answer.missingData ? <DetailRow label="Eksik veri" value={answer.missingData} /> : null}
              <DetailRow label="Önerilen aksiyon" value={answer.action} />
            </div>
            <div className="business-assistant-note">
              <Send size={16} />
              <span>Bu cevap KOBİ nakit akışı, tahsilat verisi ve müşteri skorlarına göre hazırlanır.</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="business-assistant-compact">
          <div className="business-assistant-avatar">
            <span className="agent-pet" aria-hidden="true" />
            <div>
              <strong>Bay Yengeç</strong>
              <span>Veriye dayalı KOBİ cevabı</span>
            </div>
          </div>
          <div className="business-assistant-answer business-assistant-compact-answer">
            <div className="business-assistant-answer-head">
              <Bot size={20} />
              <div>
                <span>{activeQuestionLabel}</span>
                <strong>{answer.result}</strong>
              </div>
            </div>
            <p>{answer.reason}</p>
            <small>{answer.action}</small>
          </div>
          <div className="business-assistant-quick-prompts">
            {businessAssistantPrompts.slice(0, 3).map((prompt) => (
              <button className={!customPrompt && prompt.id === selectedPrompt ? "business-assistant-question active" : "business-assistant-question"} key={prompt.id} type="button" onClick={() => selectPrompt(prompt.id)}>
                <MessageSquareText size={17} />
                <span>{prompt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function RecordsOverviewPanel({ customers, dashboard, scores }: { customers: BusinessCustomer[]; dashboard: BusinessDashboard; scores: CollectionScore[] }) {
  const totalCollections = sumNumbers(dashboard.expectedCollections.map((event) => event.amount));
  const totalPayments = sumNumbers(dashboard.upcomingPayments.map((event) => event.amount));
  const totalOutstanding = sumNumbers(customers.map((customer) => customer.outstandingAmount));
  const lateCustomerCount = customers.filter((customer) => customer.invoicesLate > 0).length;
  const averageScore = scores.length > 0 ? Math.round(sumNumbers(scores.map((score) => score.score)) / scores.length) : 0;
  const facts: DetailFact[] = [
    { label: "Nakit olayı", value: `${dashboard.expectedCollections.length + dashboard.upcomingPayments.length}` },
    { label: "Beklenen tahsilat", value: formatTry(totalCollections), tone: "positive" },
    { label: "Yaklaşan ödeme", value: formatTry(totalPayments), tone: "negative" },
    { label: "Tahsilat skoru", value: scores.length > 0 ? `${averageScore}/100` : "Veri yok" }
  ];

  return (
    <section className="panel records-overview-panel detail-panel">
      <BusinessSectionIntro
        description="Nakit olayları ve müşteri kayıtları bu moddaki tüm analizlerin temelidir."
        eyebrow="Veri Girişi"
        facts={facts}
        title="Kayıtları güncelle, analizlerin kalitesini artır"
      />
      <div className="business-detail-grid">
        <DetailBlock title="Nakit veri kalitesi">
          <DetailRow label="Tahsilat kaydı" value={`${dashboard.expectedCollections.length} adet · ${formatTry(totalCollections)}`} />
          <DetailRow label="Ödeme kaydı" value={`${dashboard.upcomingPayments.length} adet · ${formatTry(totalPayments)}`} />
          <DetailRow label="Projeksiyon" value={`${formatTry(dashboard.projected30Days)} 30 gün sonu tahmini kasa`} />
        </DetailBlock>
        <DetailBlock title="Müşteri veri kalitesi">
          <DetailRow label="Müşteri" value={`${customers.length} kayıt`} />
          <DetailRow label="Geciken müşteri" value={`${lateCustomerCount} kayıt`} />
          <DetailRow label="Açık bakiye" value={formatTry(totalOutstanding)} />
        </DetailBlock>
      </div>
    </section>
  );
}

function CashEventsPanel({ businessId, dashboard }: { businessId: string; dashboard: BusinessDashboard }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"inflow" | "outflow">("inflow");
  const [dueAt, setDueAt] = useState(() => localDateInputValue());
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await createBusinessCashEvent(businessId, {
        title: title.trim(),
        amount: parseRequiredMoney(amount, "Tutar"),
        type,
        dueAt
      });
      setTitle("");
      setAmount("");
      setStatus({ tone: "ok", text: "Nakit olayı eklendi." });
      router.refresh();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Nakit olayı eklenemedi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">
        <span>Nakit Olayları</span>
        <strong>{dashboard.upcomingPayments.length + dashboard.expectedCollections.length} kayıt</strong>
      </div>
      <div className="action-list">
        {[...dashboard.upcomingPayments, ...dashboard.expectedCollections].map((event) => {
          const isInflow = event.type === "inflow";
          return (
            <div className="action-row" key={event.id}>
              <span>{event.title}</span>
              <strong className={isInflow ? "positive-text" : "negative-text"}>{isInflow ? "+" : "-"} {formatTry(event.amount)}</strong>
              <small>{event.dueAt}</small>
            </div>
          );
        })}
        {dashboard.upcomingPayments.length + dashboard.expectedCollections.length === 0 ? <div className="empty-state">Nakit olayı yok.</div> : null}
      </div>
      <form className="business-form compact" onSubmit={submit}>
        <label className="field">
          <span>Başlık</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Müşteri tahsilatı" />
        </label>
        <label className="field">
          <span>Tutar (₺)</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} required inputMode="decimal" placeholder="50000" />
        </label>
        <label className="field">
          <span>Tür</span>
          <select value={type} onChange={(event) => setType(event.target.value as "inflow" | "outflow")}>
            <option value="inflow">Tahsilat</option>
            <option value="outflow">Ödeme</option>
          </select>
        </label>
        <label className="field">
          <span>Tarih</span>
          <input value={dueAt} onChange={(event) => setDueAt(event.target.value)} required type="date" />
        </label>
        <button className="secondary-button" type="submit" disabled={pending}>
          <CalendarPlus size={16} />
          {pending ? "Ekleniyor" : "Nakit olayı ekle"}
        </button>
      </form>
      {status ? <p className={`form-message ${status.tone === "error" ? "danger" : ""}`}>{status.text}</p> : null}
    </div>
  );
}

function CustomersPanel({ businessId, customers, scores }: { businessId: string; customers: BusinessCustomer[]; scores: CollectionScore[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [averageDelayDays, setAverageDelayDays] = useState("");
  const [invoicesPaid, setInvoicesPaid] = useState("");
  const [invoicesLate, setInvoicesLate] = useState("");
  const [outstandingAmount, setOutstandingAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await createBusinessCustomer(businessId, {
        name: name.trim(),
        averageDelayDays: parseOptionalInteger(averageDelayDays, "Ortalama gecikme günü"),
        invoicesPaid: parseOptionalInteger(invoicesPaid, "Ödenen fatura"),
        invoicesLate: parseOptionalInteger(invoicesLate, "Geciken fatura"),
        outstandingAmount: parseOptionalMoney(outstandingAmount, "Açık bakiye")
      });
      setName("");
      setAverageDelayDays("");
      setInvoicesPaid("");
      setInvoicesLate("");
      setOutstandingAmount("");
      setStatus({ tone: "ok", text: "Müşteri eklendi." });
      router.refresh();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Müşteri eklenemedi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">
        <span>Tahsilat Skorları</span>
        <strong>{customers.length} müşteri</strong>
      </div>
      {scores.length > 0 ? (
        scores.map((score) => {
          const customer = customers.find((item) => item.id === score.customerId);
          return (
            <div className="score-row" key={score.customerId}>
              <span>{customer?.name ?? score.customerId}</span>
              <strong>{score.score}/100</strong>
              <small>{score.recommendation}</small>
            </div>
          );
        })
      ) : (
        <div className="empty-state">Tahsilat skoru için müşteri kaydı yok.</div>
      )}
      <form className="business-form compact" onSubmit={submit}>
        <label className="field">
          <span>Müşteri adı</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Atlas Perakende" />
        </label>
        <label className="field">
          <span>Ortalama gecikme günü</span>
          <input value={averageDelayDays} onChange={(event) => setAverageDelayDays(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>
        <label className="field">
          <span>Ödenen fatura</span>
          <input value={invoicesPaid} onChange={(event) => setInvoicesPaid(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>
        <label className="field">
          <span>Geciken fatura</span>
          <input value={invoicesLate} onChange={(event) => setInvoicesLate(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>
        <label className="field">
          <span>Açık bakiye</span>
          <input value={outstandingAmount} onChange={(event) => setOutstandingAmount(event.target.value)} inputMode="decimal" placeholder="0" />
        </label>
        <button className="secondary-button" type="submit" disabled={pending}>
          <UserPlus size={16} />
          {pending ? "Ekleniyor" : "Müşteri ekle"}
        </button>
      </form>
      {status ? <p className={`form-message ${status.tone === "error" ? "danger" : ""}`}>{status.text}</p> : null}
    </div>
  );
}

function BusinessSectionIntro({
  description,
  eyebrow,
  facts,
  title
}: {
  description: string;
  eyebrow: string;
  facts: DetailFact[];
  title: string;
}) {
  return (
    <div className="business-section-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="business-detail-facts">
        {facts.map((fact) => (
          <MiniFact key={`${fact.label}-${fact.value}`} label={fact.label} tone={fact.tone} value={fact.value} />
        ))}
      </div>
    </div>
  );
}

function DetailBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="business-detail-block">
      <strong>{title}</strong>
      <div className="business-detail-rows">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="business-detail-row">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function MiniFact({ label, tone, value }: { label: string; tone?: DetailFact["tone"]; value: string }) {
  return (
    <div className={tone ? `mini-fact ${tone}-fact` : "mini-fact"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function sumNumbers(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function lowestCashflowPoint(points: BusinessCashflowPoint[]): BusinessCashflowPoint | undefined {
  return points.reduce<BusinessCashflowPoint | undefined>((lowest, point) => {
    if (!lowest || point.balance < lowest.balance) return point;
    return lowest;
  }, undefined);
}

function twinResultText(insights: BusinessInsights): string {
  if (insights.summary.riskLevel === "high" || insights.summary.riskLevel === "critical") {
    return `Nakit risk seviyesi ${riskLabel(insights.summary.riskLevel)}; en düşük tahmini bakiye ${formatTry(insights.summary.lowestProjectedBalance30Days)}.`;
  }
  return `Kayıtlı verilere göre 30 gün sonu tahmini kasa ${formatTry(insights.summary.projected30Days)}.`;
}

function twinActionText(insights: BusinessInsights): string {
  if (insights.missingData.length > 0) return "Eksik veri alanları tamamlanırsa finansal ikiz daha güvenilir uyarı üretir.";
  if (insights.collectionPriorities.length > 0 && insights.summary.overdueReceivables > 0) {
    return `${insights.collectionPriorities[0].customerName} tahsilatı önceliklendirilirse kısa vadeli nakit tamponu güçlenir.`;
  }
  if (insights.coverage.deferrablePayment) return `${insights.coverage.deferrablePayment.title} ödeme tarihi ayrıca değerlendirilebilir.`;
  return "Mevcut projeksiyonu korumak için kayıtlı tahsilat ve ödeme tarihleri düzenli güncellenmeli.";
}

function coverageDecisionResult(coverage: BusinessCoverageAnalysis): string {
  if (coverage.comfortLevel === "missing_data") return "Maaş veya kira etiketi olmadığı için analiz tamamlanamadı.";
  if (coverage.canCover && coverage.shortfall === 0) return "Maaş ve kira ödemeleri güvenli tampon korunarak karşılanabiliyor.";
  if (coverage.canCover) return "Ödemeler karşılanıyor ancak güvenli tampon zayıflıyor.";
  return "Ödeme döneminde nakit açığı riski oluşuyor.";
}

function coverageActionText(coverage: BusinessCoverageAnalysis): string {
  if (coverage.comfortLevel === "missing_data") return "Maaş ve kira ödeme kayıtlarını etiketleyerek yeniden hesaplama yapılmalı.";
  if (coverage.relievingCollection) return `${coverage.relievingCollection.title} tahsilatı takip edilirse tampon açığı azalır.`;
  if (coverage.deferrablePayment) return `${coverage.deferrablePayment.title} için erteleme etkisi ayrıca değerlendirilebilir.`;
  return "Kritik ödeme haftasından önce güncel tahsilat ve ödeme kayıtları kontrol edilmeli.";
}

function scenarioAssumptionText(scenario: BusinessScenarioAnalysis): string {
  return `${scenario.label} varsayımı uygulandı; veri setindeki diğer nakit olayları aynı kaldı. Para birimi TRY olarak gösterildi.`;
}

function scenarioConfidenceText(scenario: BusinessScenarioAnalysis): string {
  return scenario.description.includes("bulunmadı") ? "Düşük - ilgili nakit olayı bulunamadı." : "Orta - kayıtlı nakit olayları üzerinden hesaplandı.";
}

type BusinessAssistantAnswer = {
  action: string;
  assumptions: string;
  confidence: string;
  focus: string;
  missingData?: string;
  reason: string;
  result: string;
};

function inferBusinessAssistantPrompt(question: string): BusinessAssistantPromptId {
  const normalized = question.toLocaleLowerCase("tr-TR");
  if (includesAny(normalized, ["tahsil", "müşteri", "musteri", "fatura", "alacak", "vade", "gecik"])) return "collections";
  if (includesAny(normalized, ["maaş", "maas", "kira", "zorunlu", "ödeyebilir", "odeyebilir", "karşıla", "karsila"])) return "coverage";
  if (includesAny(normalized, ["kritik", "tarih", "gün", "gun", "ne zaman", "deadline", "takvim"])) return "critical";
  return "risk";
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function businessAssistantAnswer(prompt: BusinessAssistantPromptId, dashboard: BusinessDashboard, insights: BusinessInsights, question?: string): BusinessAssistantAnswer {
  const parsedAmount = question ? parseAmountFromText(question) : undefined;
  const questionAmount = parsedAmount?.value && parsedAmount.confidence >= 0.45 ? parsedAmount.value : undefined;
  const focus = businessAssistantFocusText(prompt, questionAmount);
  const missingData = insights.missingData.length > 0 ? insights.missingData.join(" ") : undefined;

  if (prompt === "risk" && questionAmount) {
    const projectedAfterDecision = dashboard.projected30Days - questionAmount;
    const decisionRiskLevel = cashProjectionRiskLevel(projectedAfterDecision);
    return {
      result: `${formatTry(questionAmount)} kararından sonra 30 gün sonu tahmini kasa ${formatTry(projectedAfterDecision)} olur.`,
      reason: "Serbest sorudaki tutar, kayıtlı 30 günlük KOBİ kasa projeksiyonundan tek seferlik nakit çıkışı olarak düşüldü.",
      focus,
      assumptions: "Karar tutarı tek seferlik çıkış kabul edildi; kayıtlı tahsilat ve ödeme tarihleri değişmeden kaldı. Para birimi TRY olarak gösterildi.",
      confidence: dashboard.upcomingPayments.length + dashboard.expectedCollections.length > 0 ? `Orta - nakit olaylarına bağlı; karar sonrası risk ${riskLabel(decisionRiskLevel)}.` : `Düşük - nakit olayı sınırlı; karar sonrası risk ${riskLabel(decisionRiskLevel)}.`,
      missingData,
      action:
        decisionRiskLevel === "critical" || decisionRiskLevel === "high"
          ? "Kararı fazlara bölmeden önce tahsilat teyidi ve ödeme erteleme alternatifi kontrol edilmeli."
          : "Tutarı Senaryolar ekranındaki özel simülasyonla da kaydedip nakit etkisi izlenmeli."
    };
  }

  if (prompt === "coverage") {
    return {
      result: coverageDecisionResult(insights.coverage),
      reason: insights.coverage.explanation,
      focus,
      assumptions: "Yalnızca kayıtlı maaş ve kira ödeme olayları ile beklenen tahsilatlar dikkate alındı.",
      confidence: insights.coverage.comfortLevel === "missing_data" ? "Düşük - maaş/kira etiketi eksik." : "Orta - kayıtlı KOBİ nakit olaylarına bağlı.",
      missingData,
      action: coverageActionText(insights.coverage)
    };
  }

  if (prompt === "collections") {
    const priority = insights.collectionPriorities[0];
    if (!priority) {
      return {
        result: "Önceliklendirilecek geciken tahsilat görünmüyor.",
        reason: "Müşteri açık bakiye ve gecikme verilerinde acil tahsilat sinyali oluşmadı.",
        focus,
        assumptions: "Kayıtlı müşteri skorları ve açık bakiye alanları kullanıldı.",
        confidence: dashboard.expectedCollections.length > 0 ? "Orta - tahsilat kayıtları var." : "Düşük - tahsilat kaydı sınırlı.",
        missingData,
        action: "Yeni fatura ve müşteri gecikme verileri girildikçe tahsilat önceliği yeniden hesaplanmalı."
      };
    }
    return {
      result: `${priority.customerName} ilk tahsilat odağı olmalı.`,
      reason: `${formatTry(priority.outstandingAmount)} açık bakiye, ${priority.averageDelayDays} gün ortalama gecikme ve ${riskLabel(priority.riskLevel)} risk sinyali var.`,
      focus,
      assumptions: "Müşteri skoru, açık bakiye ve ortalama gecikme günleri birlikte değerlendirildi.",
      confidence: "Orta - müşteri ödeme geçmişi kayıtlarına bağlı.",
      missingData,
      action: priority.action
    };
  }

  if (prompt === "critical") {
    const criticalDates = insights.twin.criticalDates.slice(0, 3);
    if (criticalDates.length === 0) {
      return {
        result: "Önümüzdeki 30 gün için kritik gün görünmüyor.",
        reason: `Kayıtlı nakit akışı 30 gün sonunda ${formatTry(insights.summary.projected30Days)} projeksiyon üretiyor.`,
        focus,
        assumptions: "Kayıtlı tahsilat ve ödeme tarihleri değişmeden kaldı.",
        confidence: dashboard.upcomingPayments.length + dashboard.expectedCollections.length > 0 ? "Orta - nakit olaylarına bağlı." : "Düşük - nakit olayı az.",
        missingData,
        action: "Yeni ödeme veya tahsilat eklendiğinde kritik günler yeniden kontrol edilmeli."
      };
    }
    return {
      result: `${criticalDates.length} kritik gün öne çıkıyor.`,
      reason: criticalDates.map((date) => `${formatDateLabel(date.date)}: ${formatTry(date.projectedBalance)} (${riskLabel(date.riskLevel)})`).join(", "),
      focus,
      assumptions: "Kritik günler günlük tahmini nakit bakiyesi üzerinden seçildi.",
      confidence: "Orta - kayıtlı nakit akışı tarih doğruluğuna bağlı.",
      missingData,
      action: "Bu tarihlerden önce tahsilat teyidi veya ödeme erteleme planı hazırlanmalı."
    };
  }

  return {
    result: `Nakit risk skoru ${insights.summary.cashRiskScore}/100 ve seviye ${riskLabel(insights.summary.riskLevel)}.`,
    reason: `30 gün sonu kasa ${formatTry(insights.summary.projected30Days)}, en düşük tahmini bakiye ${formatTry(insights.summary.lowestProjectedBalance30Days)}.`,
    focus,
    assumptions: "Kayıtlı KOBİ kasa, beklenen tahsilat, yaklaşan ödeme ve müşteri gecikme verileri kullanıldı.",
    confidence: dashboard.upcomingPayments.length + dashboard.expectedCollections.length > 0 ? "Orta - nakit olayları mevcut." : "Düşük - kayıtlı nakit olayı sınırlı.",
    missingData,
    action: twinActionText(insights)
  };
}

function businessAssistantFocusText(prompt: BusinessAssistantPromptId, amount?: number): string {
  const label = {
    coverage: "Maaş/kira karşılanabilirliği",
    risk: "Nakit riski",
    collections: "Tahsilat önceliği",
    critical: "Kritik günler"
  }[prompt];
  return amount ? `${label}; serbest sorudaki tutar: ${formatTry(amount)}.` : label;
}

function cashProjectionRiskLevel(balance: number) {
  if (balance < 0) return "critical";
  if (balance < 50000) return "high";
  if (balance < 100000) return "medium";
  return "low";
}

function simulationAssumptionText(simulation: AiCfoSimulation) {
  return simulation.assumptions.length ? simulation.assumptions.join(" ") : "Kayıtlı KOBİ nakit olayları üzerinden hesaplandı.";
}

function simulationConfidenceText(simulation: AiCfoSimulation) {
  return `${dataConfidenceLabel(simulation.dataConfidenceLevel)} (${Math.round(simulation.dataConfidence * 100)}%) - ${riskLabel(simulation.riskLevel)} risk.`;
}

function riskFactTone(level: string): DetailFact["tone"] {
  if (level === "high" || level === "critical") return "negative";
  if (level === "medium") return "warning";
  return "positive";
}

function riskFromScoreValue(score: number) {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function dataConfidenceLabel(confidence: BusinessDna["dataConfidenceLevel"]) {
  return {
    high: "Yüksek",
    medium: "Orta",
    low: "Düşük"
  }[confidence];
}

function formatTry(value: number) {
  return formatCurrency(Math.round(value));
}

function parseOptionalMoney(value: string | number | undefined, field: string) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${field} geçerli sıfır veya pozitif sayı olmalı.`);
    return value;
  }
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${field} geçerli sıfır veya pozitif sayı olmalı.`);
  return parsed;
}

function parseRequiredMoney(value: string, field: string) {
  const parsed = parseOptionalMoney(value, field);
  if (parsed === undefined || parsed <= 0) throw new Error(`${field} pozitif sayı olmalı.`);
  return parsed;
}

function parseOptionalInteger(value: string, field: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${field} geçerli sıfır veya pozitif tam sayı olmalı.`);
  return parsed;
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function riskLabel(level: string) {
  return {
    low: "düşük",
    medium: "orta",
    high: "yüksek",
    critical: "kritik"
  }[level] ?? level;
}

function riskToneClass(level: string) {
  return {
    low: "risk-low",
    medium: "risk-medium",
    high: "risk-high",
    critical: "risk-critical"
  }[level] ?? "risk-low";
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00.000Z`));
}
