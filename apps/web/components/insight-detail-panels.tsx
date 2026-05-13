import type { DashboardSummary, SpendingDna, SpendingDnaCategory, SubscriptionLeak, WhatIfResponse } from "@fintwin/shared";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, Info, MessageSquareText, PiggyBank, ShieldAlert, TrendingDown, WalletCards } from "lucide-react";
import type { CampaignReadiness } from "../lib/api";

export function WhatIfDetailPanel({ whatIf }: { whatIf: WhatIfResponse }) {
  const hasCards = whatIf.cards.length > 0;
  return (
    <section className="detail-stack">
      <div className="insight-grid three">
        <StatTile label="Dikkatli harcama sınırı" value={formatMoney(whatIf.safeLimit)} caption="Bu tutarın üstündeyse önce etkisini kontrol et." />
        <StatTile label="Emotional Delay" value={`${whatIf.emotionalDelayMinutes || 0} dk`} caption="Riskli harcama öncesi bekleme önerisi." />
        <StatTile label="Veri güveni" value={confidenceLabel(whatIf.dataConfidenceLevel, whatIf.dataConfidence)} caption="Eksik veri varsa sonuç daha temkinli okunmalı." />
      </div>

      <div className="panel detail-panel">
        <div className="section-title">
          <span>Senaryo kartları</span>
          <strong>{whatIf.resolvedCategoryName ?? "Genel harcama"}</strong>
        </div>
        {hasCards ? (
          <div className="scenario-list detailed">
            {whatIf.cards.map((card) => (
              <article className={`scenario ${card.id}`} key={card.id}>
                <span>{card.label}</span>
                <strong>{formatMoney(card.spendAmount)}</strong>
                <small>{card.recommendation}</small>
                <div className="scenario-facts">
                  <span>Ay sonu: {formatMoney(card.monthEndBalance)}</span>
                  <span>Borç etkisi: {formatMoney(card.debtImpact)}</span>
                  <span>Tasarruf etkisi: %{formatNumber(card.savingsImpactPercent)}</span>
                </div>
                {card.reasons?.length ? <ReasonList reasons={card.reasons} /> : null}
                {card.warning ? <p className="inline-warning">{card.warning}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyDetail message="Gelir, gider veya bütçe verisi eklenince what-if senaryoları gerçek limitlerle hesaplanır." />
        )}
      </div>

      <CashflowPanel whatIf={whatIf} />
    </section>
  );
}

export function EmotionalDelayDetailPanel({ whatIf, campaign }: { whatIf: WhatIfResponse; campaign: CampaignReadiness }) {
  const delay = whatIf.emotionalDelayMinutes || 0;
  return (
    <section className="detail-stack">
      <div className="hero-insight panel">
        <div>
          <p className="eyebrow">Dürtüsel harcama freni</p>
          <h2>{delay > 0 ? `${delay} dakika bekle, sonra tekrar değerlendir.` : "Bekleme süresi için yeterli risk sinyali yok."}</h2>
          <p>
            Emotional Delay; kampanya hassasiyeti, nakit akışı, harcama sınırı ve veri güvenini birlikte okuyarak karar anında kısa bir soğuma süresi önerir.
          </p>
        </div>
        <div className="delay-orb">
          <Clock3 size={28} />
          <strong>{delay}</strong>
          <span>dakika</span>
        </div>
      </div>

      <div className="insight-grid three">
        <StatTile label="Dikkatli harcama sınırı" value={formatMoney(whatIf.safeLimit)} caption="Harcamayı tekrar düşünmen gereken eşik." />
        <StatTile label="Kampanya skoru" value={`${campaign.score}/100`} caption={campaign.notes[0] ?? "Kampanya tetikleyicisi izleniyor."} />
        <StatTile label="Risk seviyesi" value={riskTitle(campaign.riskLevel)} caption="Karar destek seviyesidir, kesin tavsiye değildir." />
      </div>

      <div className="split-layout">
        <div className="panel">
          <div className="section-title">
            <span>Neden</span>
            <strong>{confidenceLabel(whatIf.dataConfidenceLevel, whatIf.dataConfidence)}</strong>
          </div>
          {campaign.notes.length || whatIf.assumptions.length ? (
            <ul className="detail-list">
              {[...campaign.notes, ...whatIf.assumptions].map((item) => (
                <li key={item}>
                  <Info size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyDetail message="Açıklama üretmek için yeterli sinyal yok." />
          )}
        </div>
        <CashflowPanel whatIf={whatIf} compact />
      </div>

      <AssumptionPanel assumptions={[]} missingData={whatIf.missingData} />
    </section>
  );
}

export function SubscriptionHunterDetailPanel({ leaks }: { leaks: SubscriptionLeak[] }) {
  const monthlyImpact = leaks.reduce((total, leak) => total + leak.monthlyImpact, 0);
  const yearlyImpact = monthlyImpact * 12;
  return (
    <section className="detail-stack">
      <div className="insight-grid three">
        <StatTile label="Açık bulgu" value={`${leaks.length}`} caption="Tekrar eden veya sızıntı şüphesi olan abonelikler." />
        <StatTile label="Aylık etki" value={formatMoney(monthlyImpact)} caption="İptal/optimizasyonla geri kazanılabilecek alan." />
        <StatTile label="Yıllık iz" value={formatMoney(yearlyImpact)} caption="Aylık etkinin 12 aylık karşılığı." />
      </div>

      <div className="panel detail-panel">
        <div className="section-title">
          <span>Abonelik bulguları</span>
          <strong>{leaks.length ? "Aksiyon önerileri hazır" : "Temiz"}</strong>
        </div>
        {leaks.length ? (
          <div className="subscription-detail-list">
            {leaks.map((leak) => (
              <article className="subscription-detail-card" key={`${leak.subscriptionId}-${leak.issue}`}>
                <div className="subscription-detail-icon">
                  <TrendingDown size={19} />
                </div>
                <div>
                  <span className={`chip ${leak.monthlyImpact >= 500 ? "danger" : "warn"}`}>{issueLabel(leak.issue)}</span>
                  <h3>{leak.merchant}</h3>
                  <p>{leak.recommendation}</p>
                </div>
                <strong>{formatMoney(leak.monthlyImpact)}/ay</strong>
              </article>
            ))}
          </div>
        ) : (
          <EmptyDetail message="Tekrar eden abonelik sızıntısı bulunmadı. Ekstre import ettikçe avcı daha net çalışır." />
        )}
      </div>
    </section>
  );
}

export function SpendingDnaDetailPanel({ dna }: { dna: SpendingDna }) {
  const categories = [...dna.categories].sort((left, right) => right.riskScore - left.riskScore);
  const metrics = dna.metrics;
  const commentary = dna.commentary;
  return (
    <section className="detail-stack">
      <div className="insight-grid four">
        <StatTile label="Genel risk" value={`${dna.overallRisk}/100`} caption={metricCaption(metrics?.overallRisk.reasons, dna.reasons)} />
        <StatTile label="Maaş günü refleksi" value={`${dna.paydayReflexScore}/100`} caption={metricCaption(metrics?.paydayReflexScore.reasons)} />
        <StatTile label="Hafta sonu/gece" value={`${dna.weekendNightScore}/100`} caption={metricCaption(metrics?.weekendNightScore.reasons)} />
        <StatTile label="Tasarruf disiplini" value={`${dna.savingDiscipline}/100`} caption={metricCaption(metrics?.savingDiscipline.reasons)} />
      </div>

      <div className="split-layout">
        <div className="panel detail-panel">
          <div className="section-title">
            <span>Kategori riskleri</span>
            <strong>{confidenceLabel(dna.dataConfidenceLevel, dna.dataConfidence)}</strong>
          </div>
          {categories.length ? (
            <div className="progress-list detailed">
              {categories.map((category) => (
                <CategoryRiskRow category={category} key={category.categoryId} />
              ))}
            </div>
          ) : (
            <EmptyDetail message="Risk skorlayacak kategori verisi henüz yok." />
          )}
        </div>

        <div className="spending-dna-side-stack">
          <div className="panel detail-panel">
            <div className="section-title">
              <span>Davranış sinyalleri</span>
              <strong>{dna.timeZone ?? "Europe/Istanbul"}</strong>
            </div>
            {dna.patterns.length ? (
              <ul className="detail-list">
                {dna.patterns.map((pattern) => (
                  <li key={pattern}>
                    <CheckCircle2 size={16} />
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyDetail message="Yeterli işlem geçmişi oluşunca davranış paterni listelenir." />
            )}
          </div>

          <div className="panel detail-panel spending-dna-commentary-panel">
            <div className="section-title">
              <span>Yorum</span>
              <strong>{commentary?.source === "llm" ? "LLM" : "Beklemede"}</strong>
            </div>
            {commentary ? (
              <div className="spending-dna-commentary">
                <MessageSquareText size={19} />
                <p>{commentary.summary}</p>
                {commentary.takeaways.length ? (
                  <ul className="reason-list compact">
                    {commentary.takeaways.map((item) => (
                      <li key={item}>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <EmptyDetail message="Risk skorları geldikten sonra LLM yorumu burada gösterilir." />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoryDistributionDetailPanel({ dashboard }: { dashboard: DashboardSummary }) {
  const total = dashboard.categoryBreakdown.reduce((sum, item) => sum + item.value, 0);
  const sorted = [...dashboard.categoryBreakdown].sort((left, right) => right.value - left.value);
  const topCategory = sorted[0];
  return (
    <section className="detail-stack">
      <div className="insight-grid four">
        <StatTile label="Toplam gider" value={formatMoney(dashboard.expenses)} caption={dashboard.periodLabel} />
        <StatTile label="Kategori sayısı" value={`${dashboard.categoryBreakdown.length}`} caption="Bu dönem işlem görülen kategoriler." />
        <StatTile label="En yüksek kategori" value={topCategory?.name ?? "Yok"} caption={topCategory ? formatMoney(topCategory.value) : "Veri bekleniyor"} />
        <StatTile label="Tasarruf oranı" value={`%${formatNumber(dashboard.savingsRate)}`} caption="Gelir-gider dengesinden hesaplandı." />
      </div>

      <div className="panel detail-panel">
        <div className="section-title">
          <span>Kategori dağılımı</span>
          <strong>{dashboard.periodLabel}</strong>
        </div>
        {sorted.length ? (
          <div className="category-detail-list">
            {sorted.map((item) => {
              const percent = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <article className="category-detail-row" key={item.categoryId}>
                  <div className="category-swatch" style={{ background: item.color }} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{formatMoney(item.value)}</span>
                  </div>
                  <div className="category-share">
                    <span>%{formatNumber(percent)}</span>
                    <div className="progress-track" aria-hidden="true">
                      <span style={{ background: item.color, width: `${Math.max(4, Math.min(percent, 100))}%` }} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyDetail message="Fiş, ekstre veya manuel işlem eklenince kategori dağılımı burada detaylı görünür." />
        )}
      </div>
    </section>
  );
}

function CashflowPanel({ whatIf, compact = false }: { whatIf: WhatIfResponse; compact?: boolean }) {
  const cashflow = whatIf.cashflow;
  return (
    <div className="panel detail-panel">
      <div className="section-title">
        <span>Nakit akışı</span>
        <strong>{cashflow ? formatMoney(cashflow.availableCash) : "Veri bekleniyor"}</strong>
      </div>
      {cashflow ? (
        <div className={compact ? "cashflow-grid compact" : "cashflow-grid"}>
          <MiniMetric icon={<WalletCards size={16} />} label="Mevcut bakiye" value={formatMoney(cashflow.currentBalance)} />
          <MiniMetric icon={<CircleDollarSign size={16} />} label="Beklenen gelir" value={formatMoney(cashflow.expectedIncomeUntilMonthEnd)} />
          <MiniMetric icon={<AlertTriangle size={16} />} label="Sabit gider" value={formatMoney(cashflow.fixedExpensesDue)} />
          <MiniMetric icon={<ShieldAlert size={16} />} label="Borç ödemesi" value={formatMoney(cashflow.debtPaymentsDue)} />
          <MiniMetric icon={<PiggyBank size={16} />} label="Planlı birikim" value={formatMoney(cashflow.plannedSavings)} />
          <MiniMetric icon={<CalendarClock size={16} />} label="Maaşa kalan" value={cashflow.daysUntilNextIncome === undefined ? "Yok" : `${cashflow.daysUntilNextIncome} gün`} />
        </div>
      ) : (
        <EmptyDetail message="Nakit akışı detayı için yeterli gelir/gider tarihi yok." />
      )}
    </div>
  );
}

function AssumptionPanel({ assumptions, missingData }: { assumptions: string[]; missingData?: string[] }) {
  if (!assumptions.length && !missingData?.length) return null;
  return (
    <div className="split-layout">
      <div className="panel detail-panel">
        <div className="section-title">
          <span>Varsayımlar</span>
          <strong>{assumptions.length}</strong>
        </div>
        {assumptions.length ? <ReasonList reasons={assumptions} /> : <EmptyDetail message="Varsayım kullanılmadı." />}
      </div>
      <div className="panel detail-panel">
        <div className="section-title">
          <span>Eksik veri</span>
          <strong>{missingData?.length ?? 0}</strong>
        </div>
        {missingData?.length ? <ReasonList reasons={missingData} tone="warn" /> : <EmptyDetail message="Eksik veri sinyali yok." />}
      </div>
    </div>
  );
}

function CategoryRiskRow({ category }: { category: SpendingDnaCategory }) {
  return (
    <div className={`risk-detail-row ${riskClass(category.riskScore)}`}>
      <div>
        <strong>{category.categoryName}</strong>
        <span>
          {formatMoney(category.monthlySpend)}
          {category.budgetLimit ? ` / ${formatMoney(category.budgetLimit)} bütçe` : ""}
        </span>
      </div>
      <div className="risk-meter">
        <span>{category.riskScore}/100</span>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${Math.max(4, Math.min(category.riskScore, 100))}%` }} />
        </div>
      </div>
      {category.reasons?.length ? <ReasonList reasons={category.reasons} compact /> : null}
    </div>
  );
}

function StatTile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <article className="detail-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="mini-metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReasonList({ reasons, tone = "neutral", compact = false }: { reasons: string[]; tone?: "neutral" | "warn"; compact?: boolean }) {
  return (
    <ul className={compact ? "reason-list compact" : "reason-list"}>
      {reasons.map((reason) => (
        <li className={tone} key={reason}>
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  );
}

function EmptyDetail({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("tr-TR")} TL`;
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "0";
}

function confidenceLabel(level?: string, score?: number) {
  if (level) return level === "high" ? "Yüksek" : level === "medium" ? "Orta" : "Düşük";
  if (score === undefined) return "Veri yok";
  return `%${Math.round(score * 100)}`;
}

function riskClass(score: number) {
  if (score >= 80) return "danger";
  if (score >= 60) return "warn";
  return "accent";
}

function riskTitle(level: string) {
  if (level === "critical") return "Kritik";
  if (level === "high") return "Yüksek";
  if (level === "medium") return "Orta";
  return "Düşük";
}

function issueLabel(issue: SubscriptionLeak["issue"]) {
  if (issue === "unused") return "Kullanılmıyor";
  if (issue === "duplicate") return "Tekrarlı";
  if (issue === "price_increase") return "Fiyat artışı";
  return "Küçük sızıntı";
}

function metricCaption(primary?: string[], fallback?: string[]) {
  const reason = primary?.[0] ?? fallback?.[0];
  return reason ?? "Gerçek işlem geçmişinden hesaplandı.";
}
