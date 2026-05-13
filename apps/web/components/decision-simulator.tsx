"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Clock3, WandSparkles } from "lucide-react";
import type { Category, WhatIfResponse } from "@fintwin/shared";
import { getCategories, getWhatIf, type CampaignReadiness } from "../lib/api";
import { localDateInputValue, parseMoneyInput } from "../lib/input-format";
import { EmotionalDelayDetailPanel, WhatIfDetailPanel } from "./insight-detail-panels";

type Status = { tone: "error" | "ok"; text: string } | null;

export function WhatIfSimulator({ initialWhatIf }: { initialWhatIf: WhatIfResponse }) {
  const [whatIf, setWhatIf] = useState(initialWhatIf);
  return (
    <section className="decision-simulator">
      <DecisionInputPanel
        currentCategoryId={whatIf.resolvedCategoryId}
        onResult={setWhatIf}
        submitIcon={<WandSparkles size={16} />}
        submitLabel="Senaryoyu hesapla"
      />
      <WhatIfDetailPanel whatIf={whatIf} />
    </section>
  );
}

export function EmotionalDelaySimulator({ initialWhatIf, campaign }: { initialWhatIf: WhatIfResponse; campaign: CampaignReadiness }) {
  const [whatIf, setWhatIf] = useState(initialWhatIf);
  return (
    <section className="decision-simulator">
      <DecisionInputPanel
        currentCategoryId={whatIf.resolvedCategoryId}
        onResult={setWhatIf}
        submitIcon={<Clock3 size={16} />}
        submitLabel="Bekleme süresini hesapla"
      />
      <EmotionalDelayDetailPanel whatIf={whatIf} campaign={campaign} />
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
          <span>Tutar</span>
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
