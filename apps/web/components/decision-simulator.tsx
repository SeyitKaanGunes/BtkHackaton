"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, History, WandSparkles, XCircle } from "lucide-react";
import type { Category, DecisionJournalSummary, SimulationHistoryItem, UserDecisionAction, WhatIfResponse } from "@fintwin/shared";
import { getCategories, getSimulationHistory, getSimulationSummary, getWhatIf, postDecisionEvent, type CampaignReadiness } from "../lib/api";
import { formatCurrency, formatCurrencyText } from "../lib/format";
import { localDateInputValue, parseMoneyInput } from "../lib/input-format";
import { EmotionalDelayDetailPanel, WhatIfDetailPanel } from "./insight-detail-panels";

type Status = { tone: "error" | "ok"; text: string } | null;

export function WhatIfSimulator({ initialWhatIf }: { initialWhatIf: WhatIfResponse }) {
  const [whatIf, setWhatIf] = useState(initialWhatIf);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [summary, setSummary] = useState<DecisionJournalSummary>(emptyDecisionSummary);
  useEffect(() => {
    void refreshDecisionJournal(setHistory, setSummary);
  }, []);
  return (
    <section className="decision-simulator">
      <DecisionInputPanel
        currentCategoryId={whatIf.resolvedCategoryId}
        onResult={setWhatIf}
        submitIcon={<WandSparkles size={16} />}
        submitLabel="Senaryoyu hesapla"
      />
      <WhatIfDetailPanel whatIf={whatIf} />
      <DecisionHistoryPanel current={whatIf} history={history} summary={summary} onJournal={(items, nextSummary) => {
        setHistory(items);
        setSummary(nextSummary);
      }} />
    </section>
  );
}

export function EmotionalDelaySimulator({ initialWhatIf, campaign }: { initialWhatIf: WhatIfResponse; campaign: CampaignReadiness }) {
  const [whatIf, setWhatIf] = useState(initialWhatIf);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);
  const [summary, setSummary] = useState<DecisionJournalSummary>(emptyDecisionSummary);
  useEffect(() => {
    void refreshDecisionJournal(setHistory, setSummary);
  }, []);
  return (
    <section className="decision-simulator">
      <DecisionInputPanel
        currentCategoryId={whatIf.resolvedCategoryId}
        onResult={setWhatIf}
        submitIcon={<Clock3 size={16} />}
        submitLabel="Bekleme süresini hesapla"
      />
      <EmotionalDelayDetailPanel whatIf={whatIf} campaign={campaign} />
      <DecisionHistoryPanel current={whatIf} history={history} summary={summary} onJournal={(items, nextSummary) => {
        setHistory(items);
        setSummary(nextSummary);
      }} />
    </section>
  );
}

function DecisionInputPanel({
  currentCategoryId,
  onResult,
  submitIcon,
  submitLabel
}: {
  currentCategoryId?: string;
  onResult: (result: WhatIfResponse) => void;
  submitIcon: ReactNode;
  submitLabel: string;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [decisionDate, setDecisionDate] = useState(() => localDateInputValue());
  const [categoryId, setCategoryId] = useState(currentCategoryId ?? "cat-other");
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);
  const expenseCategories = useMemo(() => categories.filter((category) => category.kind === "expense"), [categories]);

  useEffect(() => {
    void getCategories({ kind: "expense" })
      .then((items) => {
        setCategories(items);
        const hasCurrent = items.some((category) => category.id === categoryId);
        if (!hasCurrent) setCategoryId(items.find((category) => category.id === "cat-other")?.id ?? items[0]?.id ?? "");
      })
      .catch((error) => {
        setCategories([]);
        setStatus({ tone: "error", text: error instanceof Error ? error.message : "Kategori listesi alınamadı." });
      });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = parseMoneyInput(amount);
    if (parsedAmount === undefined || parsedAmount <= 0) {
      setStatus({ tone: "error", text: "Pozitif bir harcama tutarı gir." });
      return;
    }
    if (!categoryId) {
      setStatus({ tone: "error", text: "Kategori seçimi gerekli." });
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const result = await getWhatIf({
        amount: parsedAmount,
        categoryId,
        decisionDate,
        description: description.trim() || undefined,
        timeZone: "Europe/Istanbul"
      });
      onResult(result);
      setStatus({ tone: "ok", text: "Senaryo güncellendi." });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Senaryo hesaplanamadı." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="panel decision-input-panel">
      <div className="section-title">
        <span>Karar girdisi</span>
        <strong>canlı senaryo</strong>
      </div>
      <form className="decision-simulator-form" onSubmit={submit}>
        <label className="field">
          <span>Tutar (₺)</span>
          <input inputMode="decimal" onChange={(event) => setAmount(event.target.value)} placeholder="3500" required value={amount} />
        </label>
        <label className="field">
          <span>Kategori</span>
          <select onChange={(event) => setCategoryId(event.target.value)} required value={categoryId}>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Karar tarihi</span>
          <input onChange={(event) => setDecisionDate(event.target.value)} required type="date" value={decisionDate} />
        </label>
        <label className="field decision-description-field">
          <span>Açıklama</span>
          <input onChange={(event) => setDescription(event.target.value)} placeholder="Kıyafet, telefon, tatil..." value={description} />
        </label>
        <button className="secondary-button" disabled={pending} type="submit">
          {submitIcon}
          {pending ? "Hesaplanıyor" : submitLabel}
        </button>
      </form>
      {status ? <p className={`form-message ${status.tone === "error" ? "danger" : "success-message"}`}>{status.text}</p> : null}
    </div>
  );
}

function DecisionHistoryPanel({
  current,
  history,
  summary,
  onJournal
}: {
  current: WhatIfResponse;
  history: SimulationHistoryItem[];
  summary: DecisionJournalSummary;
  onJournal: (items: SimulationHistoryItem[], summary: DecisionJournalSummary) => void;
}) {
  const [pending, setPending] = useState<UserDecisionAction | null>(null);
  const [finalAmount, setFinalAmount] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const canRecord = Boolean(current.simulationId);

  async function record(userAction: UserDecisionAction) {
    if (!current.simulationId) {
      setStatus({ tone: "error", text: "Önce tutarlı bir senaryo hesapla; boş başlangıç senaryosu karar günlüğüne yazılmaz." });
      return;
    }
    const parsedFinalAmount = userAction === "reduced" ? parseMoneyInput(finalAmount) : undefined;
    if (userAction === "reduced" && (parsedFinalAmount === undefined || parsedFinalAmount <= 0)) {
      setStatus({ tone: "error", text: "Azaltılmış karar için yeni tutarı gir." });
      return;
    }
    setPending(userAction);
    setStatus(null);
    try {
      await postDecisionEvent(current.simulationId, { userAction, finalAmount: parsedFinalAmount });
      const [items, nextSummary] = await Promise.all([getSimulationHistory(), getSimulationSummary()]);
      onJournal(items, nextSummary);
      setStatus({ tone: "ok", text: "Karar günlüğe işlendi." });
      setFinalAmount("");
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Karar kaydedilemedi." });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="panel decision-history-panel">
      <div className="section-title">
        <span>Karar günlüğü</span>
        <strong>{history.length}</strong>
      </div>
      <div className="decision-summary-grid">
        <DecisionSummaryStat label="Net korunan nakit" value={formatCurrency(summary.netProtectedCash)} />
        <DecisionSummaryStat label="Ertelenen/iptal" value={`${summary.delayedCount + summary.cancelledCount}`} />
        <DecisionSummaryStat label="Sağlık etkisi" value={`${summary.healthAdjustment >= 0 ? "+" : ""}${summary.healthAdjustment}`} />
      </div>
      <p className="panel-copy compact-copy">{formatCurrencyText(summary.insight)}</p>
      <div className="decision-outcome-row">
        <button className="secondary-button small-button" disabled={!canRecord || Boolean(pending)} type="button" onClick={() => void record("bought")}>
          <CheckCircle2 size={15} />
          {pending === "bought" ? "Kaydediliyor" : "Aldım"}
        </button>
        <button className="secondary-button small-button" disabled={!canRecord || Boolean(pending)} type="button" onClick={() => void record("delayed")}>
          <Clock3 size={15} />
          Erteledim
        </button>
        <button className="secondary-button small-button danger-button" disabled={!canRecord || Boolean(pending)} type="button" onClick={() => void record("cancelled")}>
          <XCircle size={15} />
          Vazgeçtim
        </button>
        <label className="field reduced-amount-field">
          <span>Azaltılmış tutar</span>
          <input inputMode="decimal" value={finalAmount} onChange={(event) => setFinalAmount(event.target.value)} placeholder="2500" />
        </label>
        <button className="secondary-button small-button" disabled={!canRecord || Boolean(pending)} type="button" onClick={() => void record("reduced")}>
          Azalttım
        </button>
        <button className="secondary-button small-button" disabled={!canRecord || Boolean(pending)} type="button" onClick={() => void record("planned")}>
          Planladım
        </button>
      </div>
      {status ? <p className={`form-message ${status.tone === "error" ? "danger" : "success-message"}`}>{status.text}</p> : null}
      {history.length ? (
        <div className="decision-history-list">
          {history.slice(0, 6).map((item) => (
            <article className="decision-history-row" key={item.id}>
              <History size={16} />
              <div>
                <strong>{item.question}</strong>
                <span>
                  {item.amount ? formatCurrency(item.amount) : "Tutar yok"} · {item.categoryName ?? "Kategori yok"} · {new Date(item.createdAt).toLocaleDateString("tr-TR")}
                </span>
              </div>
              <small>{item.decisionEvents[0] ? decisionLabel(item.decisionEvents[0].userAction) : "Karar bekliyor"}</small>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">Gerçek tutarlı senaryolar burada karar geçmişine dönüşür.</div>
      )}
    </div>
  );
}

const emptyDecisionSummary: DecisionJournalSummary = {
  totalScenarios: 0,
  decidedScenarios: 0,
  delayedCount: 0,
  cancelledCount: 0,
  reducedCount: 0,
  plannedCount: 0,
  boughtCount: 0,
  avoidedSpend: 0,
  reducedSpend: 0,
  boughtSpend: 0,
  netProtectedCash: 0,
  healthAdjustment: 0,
  insight: "Henüz karar sonucu işaretlenmedi; gerçek etki için senaryo sonrası davranışı kaydet."
};

async function refreshDecisionJournal(
  setHistory: (items: SimulationHistoryItem[]) => void,
  setSummary: (summary: DecisionJournalSummary) => void
) {
  try {
    const [items, summary] = await Promise.all([getSimulationHistory(), getSimulationSummary()]);
    setHistory(items);
    setSummary(summary);
  } catch {
    setHistory([]);
    setSummary(emptyDecisionSummary);
  }
}

function DecisionSummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="decision-summary-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function decisionLabel(action: string) {
  if (action === "bought") return "Alındı";
  if (action === "delayed") return "Ertelendi";
  if (action === "cancelled") return "Vazgeçildi";
  if (action === "reduced") return "Tutar azaltıldı";
  return "Planlandı";
}
