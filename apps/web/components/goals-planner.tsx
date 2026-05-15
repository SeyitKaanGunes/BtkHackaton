"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, PiggyBank, Plus, RefreshCw, Sparkles, Target, X } from "lucide-react";
import type { Goal, GoalAdviceResponse, PlanningOverview } from "@fintwin/shared";
import { createGoal, getGoalAdvice, upsertBudget, upsertSavingsPlan } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { localDateInputValue, parseMoneyInput } from "../lib/input-format";

type Status = { tone: "ok" | "error"; text: string } | null;

export function GoalsPlanner({ initialPlanning }: { initialPlanning: PlanningOverview }) {
  const router = useRouter();
  const [planning, setPlanning] = useState(initialPlanning);
  const [monthlyAmount, setMonthlyAmount] = useState(goalAmount(initialPlanning.savingsPlan.monthly));
  const [yearlyAmount, setYearlyAmount] = useState(goalAmount(initialPlanning.savingsPlan.yearly));
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalDeadline, setGoalDeadline] = useState(() => localDateInputValue(addMonths(new Date(), 6)));
  const [budgetInputs, setBudgetInputs] = useState(() => budgetInputMap(initialPlanning));
  const [savingsStatus, setSavingsStatus] = useState<Status>(null);
  const [goalStatus, setGoalStatus] = useState<Status>(null);
  const [budgetStatus, setBudgetStatus] = useState<Status>(null);
  const [pending, setPending] = useState<"savings" | "goal" | string | null>(null);
  const [advice, setAdvice] = useState<GoalAdviceResponse | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(true);
  const [adviceVersion, setAdviceVersion] = useState(0);
  const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false);
  const customGoals = useMemo(() => planning.goals.filter((goal) => !isSavingsGoal(goal)), [planning.goals]);
  const adviceCacheKey = useMemo(() => goalAdviceCacheKey(planning), [planning]);
  const budgetRows = useMemo(
    () =>
      [...planning.categories].sort((left, right) => {
        const leftActive = planning.budgets.some((budget) => budget.categoryId === left.id);
        const rightActive = planning.budgets.some((budget) => budget.categoryId === right.id);
        if (leftActive !== rightActive) return rightActive ? 1 : -1;
        return left.name.localeCompare(right.name, "tr");
      }),
    [planning.budgets, planning.categories]
  );
  const visibleBudgetRows = budgetRows.slice(0, 6);
  const hiddenBudgetRows = budgetRows.slice(6);

  useEffect(() => {
    let cancelled = false;
    const cached = adviceVersion === 0 ? readGoalAdviceCache(adviceCacheKey) : null;
    if (cached) {
      setAdvice(cached);
      setAdviceLoading(false);
      return;
    }
    setAdviceLoading(true);
    getGoalAdvice()
      .then((result) => {
        if (!cancelled) {
          setAdvice(result);
          writeGoalAdviceCache(adviceCacheKey, result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAdvice({
            summary: error instanceof Error ? error.message : "Hedef tavsiyesi şu anda alınamadı.",
            actions: [],
            generatedAt: new Date().toISOString(),
            source: "unavailable"
          });
        }
      })
      .finally(() => {
        if (!cancelled) setAdviceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adviceCacheKey, adviceVersion]);

  async function submitSavings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const monthly = parseMoneyInput(monthlyAmount);
    const yearly = parseMoneyInput(yearlyAmount);
    if (monthly === undefined || yearly === undefined) {
      setSavingsStatus({ tone: "error", text: "Aylık ve yıllık birikim tutarı sayı olmalı." });
      return;
    }
    setPending("savings");
    setSavingsStatus(null);
    try {
      const result = await upsertSavingsPlan({ monthlyAmount: monthly, yearlyAmount: yearly });
      setPlanning((current) => ({
        ...current,
        savingsPlan: result,
        goals: mergeGoals(current.goals, [result.monthly, result.yearly].filter((goal): goal is Goal => Boolean(goal)))
      }));
      setSavingsStatus({ tone: "ok", text: "Birikim planı kaydedildi." });
      router.refresh();
      refreshAdvice();
    } catch (error) {
      setSavingsStatus({ tone: "error", text: error instanceof Error ? error.message : "Birikim planı kaydedilemedi." });
    } finally {
      setPending(null);
    }
  }

  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = parseMoneyInput(goalTarget);
    const current = parseMoneyInput(goalCurrent || "0");
    if (!goalTitle.trim() || target === undefined || target <= 0 || current === undefined || current < 0) {
      setGoalStatus({ tone: "error", text: "Hedef adı, pozitif hedef tutarı ve geçerli mevcut birikim gerekli." });
      return;
    }
    setPending("goal");
    setGoalStatus(null);
    try {
      const goal = await createGoal({
        title: goalTitle.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: goalDeadline
      });
      setPlanning((currentPlanning) => ({ ...currentPlanning, goals: mergeGoals(currentPlanning.goals, [goal]) }));
      setGoalTitle("");
      setGoalTarget("");
      setGoalCurrent("");
      setGoalDeadline(localDateInputValue(addMonths(new Date(), 6)));
      setGoalStatus({ tone: "ok", text: "Hedef eklendi." });
      router.refresh();
      refreshAdvice();
    } catch (error) {
      setGoalStatus({ tone: "error", text: error instanceof Error ? error.message : "Hedef eklenemedi." });
    } finally {
      setPending(null);
    }
  }

  async function saveBudget(categoryId: string) {
    const value = budgetInputs[categoryId] ?? "";
    const parsed = parseMoneyInput(value);
    if (parsed === undefined) {
      setBudgetStatus({ tone: "error", text: "Kategori limiti sayı olmalı." });
      return;
    }
    setPending(categoryId);
    setBudgetStatus(null);
    try {
      const budget = await upsertBudget({ categoryId, monthlyLimit: parsed });
      setPlanning((current) => ({
        ...current,
        budgets: [budget, ...current.budgets.filter((item) => item.id !== budget.id && item.categoryId !== budget.categoryId)]
      }));
      setBudgetStatus({ tone: "ok", text: "Kategori limiti kaydedildi." });
      router.refresh();
      refreshAdvice();
    } catch (error) {
      setBudgetStatus({ tone: "error", text: error instanceof Error ? error.message : "Kategori limiti kaydedilemedi." });
    } finally {
      setPending(null);
    }
  }

  function refreshAdvice() {
    removeGoalAdviceCache(adviceCacheKey);
    setAdviceVersion((current) => current + 1);
  }

  function renderBudgetRow(category: PlanningOverview["categories"][number]) {
    return (
      <article className="budget-limit-row" key={category.id}>
        <div className="category-swatch small" style={{ background: category.color }} />
        <div>
          <strong>{category.name}</strong>
          <span>{budgetCaption(planning, category.id)}</span>
        </div>
        <label className="field">
          <span>Limit (₺)</span>
          <input
            inputMode="decimal"
            onChange={(event) => setBudgetInputs((current) => ({ ...current, [category.id]: event.target.value }))}
            placeholder="3000"
            value={budgetInputs[category.id] ?? ""}
          />
        </label>
        <button className="secondary-button small-button" disabled={pending === category.id} onClick={() => void saveBudget(category.id)} type="button">
          {pending === category.id ? "Kaydediliyor" : "Kaydet"}
        </button>
      </article>
    );
  }

  return (
    <section className="goals-planner">
      <div className="insight-grid three">
        <PlanStat icon={<PiggyBank size={18} />} label="Aylık birikim" value={formatMoney(displayAmount(monthlyAmount))} />
        <PlanStat icon={<CalendarDays size={18} />} label="Yıllık birikim" value={formatMoney(displayAmount(yearlyAmount))} />
        <PlanStat icon={<Target size={18} />} label="Aktif hedef" value={`${customGoals.length}`} />
      </div>

      <GoalAdviceBubble advice={advice} loading={adviceLoading} onRefresh={refreshAdvice} />

      <div className="split-layout">
        <form className="panel goal-plan-form" onSubmit={submitSavings}>
          <div className="section-title">
            <span>Birikim planı</span>
            <strong>aylık / yıllık</strong>
          </div>
          <label className="field">
            <span>Aylık biriktirme miktarı (₺)</span>
            <input inputMode="decimal" onChange={(event) => setMonthlyAmount(event.target.value)} placeholder="5000" value={monthlyAmount} />
          </label>
          <label className="field">
            <span>Yıllık biriktirme miktarı (₺)</span>
            <input inputMode="decimal" onChange={(event) => setYearlyAmount(event.target.value)} placeholder="60000" value={yearlyAmount} />
          </label>
          <button className="secondary-button" disabled={pending === "savings"} type="submit">
            <PiggyBank size={16} />
            {pending === "savings" ? "Kaydediliyor" : "Birikimi kaydet"}
          </button>
          {savingsStatus ? <p className={`form-message ${savingsStatus.tone === "error" ? "danger" : "success-message"}`}>{savingsStatus.text}</p> : null}
        </form>

        <form className="panel goal-plan-form" onSubmit={submitGoal}>
          <div className="section-title">
            <span>Kendi hedefin</span>
            <strong>hedef tutarı</strong>
          </div>
          <label className="field">
            <span>Hedef adı</span>
            <input onChange={(event) => setGoalTitle(event.target.value)} placeholder="Araba, tatil, acil durum..." required value={goalTitle} />
          </label>
          <div className="goal-form-row">
            <label className="field">
              <span>Hedef tutarı (₺)</span>
              <input inputMode="decimal" onChange={(event) => setGoalTarget(event.target.value)} placeholder="150000" required value={goalTarget} />
            </label>
            <label className="field">
              <span>Şu an biriken (₺)</span>
              <input inputMode="decimal" onChange={(event) => setGoalCurrent(event.target.value)} placeholder="25000" value={goalCurrent} />
            </label>
          </div>
          <label className="field">
            <span>Son tarih</span>
            <input onChange={(event) => setGoalDeadline(event.target.value)} required type="date" value={goalDeadline} />
          </label>
          <button className="secondary-button" disabled={pending === "goal"} type="submit">
            <Plus size={16} />
            {pending === "goal" ? "Ekleniyor" : "Hedef ekle"}
          </button>
          {goalStatus ? <p className={`form-message ${goalStatus.tone === "error" ? "danger" : "success-message"}`}>{goalStatus.text}</p> : null}
        </form>
      </div>

      <div className="panel category-budget-panel">
        <div className="section-title">
          <span>Kategori harcama limitleri</span>
          <strong>{planning.budgets.length} aktif limit</strong>
        </div>
        <div className="budget-limit-list">
          {visibleBudgetRows.map(renderBudgetRow)}
        </div>
        {hiddenBudgetRows.length ? (
          <button className="secondary-button budget-drawer-trigger" type="button" onClick={() => setBudgetDrawerOpen(true)}>
            Tüm kategorileri düzenle ({budgetRows.length})
          </button>
        ) : null}
        {budgetStatus ? <p className={`form-message ${budgetStatus.tone === "error" ? "danger" : "success-message"}`}>{budgetStatus.text}</p> : null}
      </div>

      {budgetDrawerOpen ? (
        <div className="budget-drawer-backdrop" onMouseDown={() => setBudgetDrawerOpen(false)} role="presentation">
          <aside className="budget-drawer" role="dialog" aria-label="Kategori limitlerini düzenle" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header className="budget-drawer-header">
              <div>
                <span>Kategori limitleri</span>
                <strong>Tüm kategoriler</strong>
              </div>
              <button className="ghost-icon" onClick={() => setBudgetDrawerOpen(false)} type="button" aria-label="Kategori limitlerini kapat">
                <X size={17} />
              </button>
            </header>
            <div className="budget-drawer-list">
              {budgetRows.map(renderBudgetRow)}
            </div>
            {budgetStatus ? <p className={`form-message ${budgetStatus.tone === "error" ? "danger" : "success-message"}`}>{budgetStatus.text}</p> : null}
          </aside>
        </div>
      ) : null}

      <div className="panel active-goals-panel">
        <div className="section-title">
          <span>Aktif hedefler</span>
          <strong>{customGoals.length}</strong>
        </div>
        {customGoals.length ? (
          <div className="active-goal-list">
            {customGoals.map((goal) => (
              <article className="active-goal-row" key={goal.id}>
                <div>
                  <strong>{goal.title}</strong>
                  <span>{goal.deadline} tarihine kadar</span>
                </div>
                <div className="goal-progress-block">
                  <span>{formatMoney(goal.currentAmount)} / {formatMoney(goal.targetAmount)}</span>
                  <div className="progress-track" aria-hidden="true">
                    <span style={{ width: `${Math.max(4, Math.min((goal.currentAmount / goal.targetAmount) * 100, 100))}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Kendi hedefini eklediğinde burada takip edebilirsin.</div>
        )}
      </div>
    </section>
  );
}

function PlanStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="detail-stat-card plan-stat-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Simülasyonlarda kullanılır.</small>
    </article>
  );
}

function GoalAdviceBubble({ advice, loading, onRefresh }: { advice: GoalAdviceResponse | null; loading: boolean; onRefresh: () => void }) {
  const summary = loading ? "Hedeflerin ve limitlerin okunuyor. Birazdan sana kısa ve uygulanabilir bir yol haritası çıkaracağım." : advice?.summary ?? "Hedef tavsiyesi şu anda hazırlanamadı.";
  const actions = loading ? [] : advice?.actions ?? [];
  const panelState = loading ? "is-loading" : advice?.source === "llm" ? "is-ready" : "is-muted";

  return (
    <article className={`goal-advice-panel ${panelState}`}>
      <div className="goal-agent-wrap">
        <span className="agent-pet goal-agent-pet" aria-hidden="true" />
      </div>
      <div className="goal-advice-bubble">
        <div className="goal-advice-head">
          <span>
            <Sparkles size={16} />
            Hedef koçu
          </span>
          <button className="icon-button ghost" disabled={loading} onClick={onRefresh} title="Tavsiyeyi yenile" type="button">
            <RefreshCw size={16} />
          </button>
        </div>
        <p>{summary}</p>
        {actions.length ? (
          <ul>
            {actions.slice(0, 3).map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function budgetInputMap(planning: PlanningOverview) {
  return Object.fromEntries(planning.budgets.map((budget) => [budget.categoryId, String(budget.monthlyLimit)]));
}

function budgetCaption(planning: PlanningOverview, categoryId: string) {
  const budget = planning.budgets.find((item) => item.categoryId === categoryId);
  return budget ? `Mevcut limit: ${formatMoney(budget.monthlyLimit)}` : "Henüz limit yok";
}

function goalAmount(goal: Goal | undefined) {
  return goal ? String(goal.targetAmount) : "";
}

function isSavingsGoal(goal: Goal) {
  return goal.title === "Aylık birikim hedefi" || goal.title === "Yıllık birikim hedefi";
}

function mergeGoals(current: Goal[], next: Goal[]) {
  return [...next, ...current.filter((goal) => !next.some((item) => item.id === goal.id))].sort((left, right) => left.deadline.localeCompare(right.deadline));
}

function formatMoney(value: number) {
  return formatCurrency(Math.round(value));
}

function displayAmount(value: string) {
  return parseMoneyInput(value) ?? 0;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function goalAdviceCacheKey(planning: PlanningOverview) {
  const goals = planning.goals.map((goal) => `${goal.id}:${goal.currentAmount}:${goal.targetAmount}:${goal.deadline}`).sort();
  const budgets = planning.budgets.map((budget) => `${budget.categoryId}:${budget.monthlyLimit}`).sort();
  const savings = `${planning.savingsPlan.monthly?.targetAmount ?? 0}:${planning.savingsPlan.yearly?.targetAmount ?? 0}`;
  return `fintwin:goal-advice:${savings}:${goals.join("|")}:${budgets.join("|")}`;
}

function readGoalAdviceCache(key: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as GoalAdviceResponse) : null;
  } catch {
    return null;
  }
}

function writeGoalAdviceCache(key: string, value: GoalAdviceResponse) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

function removeGoalAdviceCache(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
}
