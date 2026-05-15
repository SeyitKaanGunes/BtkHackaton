"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, WalletCards } from "lucide-react";
import type { Account, Budget, Category, Currency, Goal, UserProfile } from "@fintwin/shared";
import { createAccount, createBudget, createGoal, createTransaction, deleteAccount, deleteBudget, deleteGoal, updateFinanceProfile } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { localDateInputValue, parseMoneyInput } from "../lib/input-format";

const currencies: Currency[] = ["TRY", "USD", "EUR"];
const accountTypes: Array<{ value: Account["type"]; label: string }> = [
  { value: "debit", label: "Vadesiz" },
  { value: "credit", label: "Kredi kartı" },
  { value: "savings", label: "Birikim" },
  { value: "cash", label: "Nakit" }
];

type Status = { tone: "ok" | "error"; text: string } | null;

export function FinancialProfilePanel({
  initialUser,
  initialAccounts,
  initialBudgets,
  initialGoals,
  categories
}: {
  initialUser: Pick<UserProfile, "monthlyIncome" | "payday" | "currency">;
  initialAccounts: Account[];
  initialBudgets: Budget[];
  initialGoals: Goal[];
  categories: Category[];
}) {
  const router = useRouter();
  const expenseCategories = useMemo(() => categories.filter((category) => category.kind === "expense"), [categories]);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [goals, setGoals] = useState(initialGoals);
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [income, setIncome] = useState(initialUser.monthlyIncome > 0 ? String(initialUser.monthlyIncome) : "");
  const [payday, setPayday] = useState(String(initialUser.payday));
  const [currency, setCurrency] = useState<Currency>(initialUser.currency);
  const [accountForm, setAccountForm] = useState({ name: "", type: "debit" as Account["type"], balance: "", currency: initialUser.currency, creditLimit: "" });
  const [budgetForm, setBudgetForm] = useState({ categoryId: expenseCategories[0]?.id ?? "", monthlyLimit: "" });
  const [goalForm, setGoalForm] = useState({ title: "", targetAmount: "", currentAmount: "", deadline: localDateInputValue() });
  const [fixedForm, setFixedForm] = useState({ merchant: "", amount: "", categoryId: expenseCategories[0]?.id ?? "cat-other", occurredAt: localDateInputValue() });

  async function run<T>(key: string, fn: () => Promise<T>, success: string) {
    setPending(key);
    setStatus(null);
    try {
      const result = await fn();
      setStatus({ tone: "ok", text: success });
      router.refresh();
      return result;
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "İşlem tamamlanamadı." });
      return undefined;
    } finally {
      setPending(null);
    }
  }

  async function submitIncome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const monthlyIncome = parseMoneyInput(income);
    const parsedPayday = Number(payday);
    if (monthlyIncome === undefined || monthlyIncome < 0 || !Number.isInteger(parsedPayday) || parsedPayday < 1 || parsedPayday > 31) {
      setStatus({ tone: "error", text: "Gelir sıfır veya pozitif, maaş günü 1-31 arasında olmalı." });
      return;
    }
    await run("income", () => updateFinanceProfile({ monthlyIncome, payday: parsedPayday, currency }), "Gelir profili kaydedildi.");
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const balance = parseMoneyInput(accountForm.balance);
    const creditLimit = parseMoneyInput(accountForm.creditLimit);
    if (!accountForm.name.trim() || balance === undefined) {
      setStatus({ tone: "error", text: "Hesap adı ve sıfır/pozitif bakiye gerekli." });
      return;
    }
    const created = await run(
      "account",
      () =>
        createAccount({
          name: accountForm.name.trim(),
          type: accountForm.type,
          balance,
          currency: accountForm.currency,
          creditLimit: accountForm.type === "credit" ? creditLimit ?? 0 : undefined
        }),
      "Hesap eklendi."
    );
    if (created) {
      setAccounts((current) => [...current, created]);
      setAccountForm((current) => ({ ...current, name: "", balance: "", creditLimit: "" }));
    }
  }

  async function submitBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const monthlyLimit = parseMoneyInput(budgetForm.monthlyLimit);
    if (!budgetForm.categoryId || monthlyLimit === undefined || monthlyLimit <= 0) {
      setStatus({ tone: "error", text: "Kategori ve pozitif bütçe limiti gerekli." });
      return;
    }
    const created = await run("budget", () => createBudget({ categoryId: budgetForm.categoryId, monthlyLimit }), "Bütçe eklendi.");
    if (created) {
      setBudgets((current) => [...current, created]);
      setBudgetForm((current) => ({ ...current, monthlyLimit: "" }));
    }
  }

  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetAmount = parseMoneyInput(goalForm.targetAmount);
    const currentAmount = parseMoneyInput(goalForm.currentAmount) ?? 0;
    if (!goalForm.title.trim() || targetAmount === undefined || targetAmount <= 0) {
      setStatus({ tone: "error", text: "Hedef adı ve pozitif hedef tutarı gerekli." });
      return;
    }
    const created = await run(
      "goal",
      () => createGoal({ title: goalForm.title.trim(), targetAmount, currentAmount, deadline: goalForm.deadline }),
      "Hedef eklendi."
    );
    if (created) {
      setGoals((current) => [...current, created].sort((left, right) => left.deadline.localeCompare(right.deadline)));
      setGoalForm({ title: "", targetAmount: "", currentAmount: "", deadline: localDateInputValue() });
    }
  }

  async function submitFixedExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoneyInput(fixedForm.amount);
    if (!fixedForm.merchant.trim() || amount === undefined || amount <= 0 || !fixedForm.categoryId) {
      setStatus({ tone: "error", text: "Sabit gider adı, kategori ve pozitif tutar gerekli." });
      return;
    }
    await run(
      "fixed",
      () =>
        createTransaction({
          merchant: fixedForm.merchant.trim(),
          amount,
          type: "expense",
          currency,
          categoryId: fixedForm.categoryId,
          occurredAt: `${fixedForm.occurredAt}T12:00:00.000Z`,
          paymentMethod: "transfer",
          recurring: true
        }),
      "Sabit gider kayıtlı tekrarlı işlem olarak eklendi."
    );
    setFixedForm((current) => ({ ...current, merchant: "", amount: "" }));
  }

  async function removeAccount(id: string) {
    const removed = await run("delete-account", () => deleteAccount(id), "Hesap silindi.");
    if (removed) setAccounts((current) => current.filter((account) => account.id !== removed.id));
  }

  async function removeBudget(id: string) {
    const removed = await run("delete-budget", () => deleteBudget(id), "Bütçe silindi.");
    if (removed) setBudgets((current) => current.filter((budget) => budget.id !== removed.id));
  }

  async function removeGoal(id: string) {
    const removed = await run("delete-goal", () => deleteGoal(id), "Hedef silindi.");
    if (removed) setGoals((current) => current.filter((goal) => goal.id !== removed.id));
  }

  return (
    <section className="detail-stack">
      <div className="insight-grid three">
        <ProfileStat label="Hesap" value={`${accounts.length}`} caption="Nakit akışı ve what-if hesaplarında kullanılır." />
        <ProfileStat label="Bütçe" value={`${budgets.length}`} caption="Spending DNA kategori riskini netleştirir." />
        <ProfileStat label="Hedef" value={`${goals.length}`} caption="Tasarruf etkisi ve acil tampon için kullanılır." />
      </div>

      <div className="split-layout">
        <form className="panel profile-form" onSubmit={submitIncome}>
          <div className="section-title">
            <span>Gelir profili</span>
            <strong>maaş / ödeme günü</strong>
          </div>
          <label className="field">
            <span>Aylık gelir ({currency === "TRY" ? "₺" : currency === "USD" ? "$" : "€"})</span>
            <input inputMode="decimal" value={income} onChange={(event) => setIncome(event.target.value)} placeholder="45000" />
          </label>
          <label className="field">
            <span>Maaş günü</span>
            <input inputMode="numeric" value={payday} onChange={(event) => setPayday(event.target.value)} placeholder="5" />
          </label>
          <label className="field">
            <span>Para birimi</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
              {currencies.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" disabled={pending === "income"} type="submit">
            <WalletCards size={16} />
            {pending === "income" ? "Kaydediliyor" : "Geliri kaydet"}
          </button>
        </form>

        <form className="panel profile-form" onSubmit={submitFixedExpense}>
          <div className="section-title">
            <span>Sabit gider</span>
            <strong>tekrarlı işlem</strong>
          </div>
          <label className="field">
            <span>Gider adı</span>
            <input value={fixedForm.merchant} onChange={(event) => setFixedForm((current) => ({ ...current, merchant: event.target.value }))} placeholder="Kira, okul, aidat" />
          </label>
          <label className="field">
            <span>Tutar (₺)</span>
            <input inputMode="decimal" value={fixedForm.amount} onChange={(event) => setFixedForm((current) => ({ ...current, amount: event.target.value }))} placeholder="15000" />
          </label>
          <label className="field">
            <span>Kategori</span>
            <select value={fixedForm.categoryId} onChange={(event) => setFixedForm((current) => ({ ...current, categoryId: event.target.value }))}>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>İlk ödeme tarihi</span>
            <input type="date" value={fixedForm.occurredAt} onChange={(event) => setFixedForm((current) => ({ ...current, occurredAt: event.target.value }))} />
          </label>
          <button className="secondary-button" disabled={pending === "fixed"} type="submit">
            <Plus size={16} />
            {pending === "fixed" ? "Ekleniyor" : "Sabit gider ekle"}
          </button>
        </form>
      </div>

      <div className="split-layout">
        <form className="panel profile-form" onSubmit={submitAccount}>
          <div className="section-title">
            <span>Hesaplar</span>
            <strong>{accounts.length}</strong>
          </div>
          <label className="field">
            <span>Hesap adı</span>
            <input value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ana vadesiz, kredi kartı" />
          </label>
          <label className="field">
            <span>Tür</span>
            <select value={accountForm.type} onChange={(event) => setAccountForm((current) => ({ ...current, type: event.target.value as Account["type"] }))}>
              {accountTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Bakiye</span>
            <input inputMode="decimal" value={accountForm.balance} onChange={(event) => setAccountForm((current) => ({ ...current, balance: event.target.value }))} placeholder="0" />
          </label>
          <label className="field">
            <span>Para birimi</span>
            <select value={accountForm.currency} onChange={(event) => setAccountForm((current) => ({ ...current, currency: event.target.value as Currency }))}>
              {currencies.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {accountForm.type === "credit" ? (
            <label className="field">
              <span>Kredi limiti</span>
              <input inputMode="decimal" value={accountForm.creditLimit} onChange={(event) => setAccountForm((current) => ({ ...current, creditLimit: event.target.value }))} placeholder="50000" />
            </label>
          ) : null}
          <button className="secondary-button" disabled={pending === "account"} type="submit">
            <Plus size={16} />
            {pending === "account" ? "Ekleniyor" : "Hesap ekle"}
          </button>
          <ProfileRows rows={accounts.map((account) => ({ id: account.id, title: account.name, meta: `${account.type} · ${formatMoney(account.balance, account.currency)}` }))} onDelete={(id) => void removeAccount(id)} />
        </form>

        <form className="panel profile-form" onSubmit={submitBudget}>
          <div className="section-title">
            <span>Bütçeler</span>
            <strong>{budgets.length}</strong>
          </div>
          <label className="field">
            <span>Kategori</span>
            <select value={budgetForm.categoryId} onChange={(event) => setBudgetForm((current) => ({ ...current, categoryId: event.target.value }))}>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Aylık limit</span>
            <input inputMode="decimal" value={budgetForm.monthlyLimit} onChange={(event) => setBudgetForm((current) => ({ ...current, monthlyLimit: event.target.value }))} placeholder="9000" />
          </label>
          <button className="secondary-button" disabled={pending === "budget"} type="submit">
            <Plus size={16} />
            {pending === "budget" ? "Ekleniyor" : "Bütçe ekle"}
          </button>
          <ProfileRows rows={budgets.map((budget) => ({ id: budget.id, title: categoryLabel(categories, budget.categoryId), meta: formatMoney(budget.monthlyLimit, currency) }))} onDelete={(id) => void removeBudget(id)} />
        </form>
      </div>

      <form className="panel profile-form" onSubmit={submitGoal}>
        <div className="section-title">
          <span>Hedefler</span>
          <strong>{goals.length}</strong>
        </div>
        <div className="profile-inline-form">
          <label className="field">
            <span>Hedef adı</span>
            <input value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} placeholder="Acil durum fonu" />
          </label>
          <label className="field">
            <span>Hedef tutarı</span>
            <input inputMode="decimal" value={goalForm.targetAmount} onChange={(event) => setGoalForm((current) => ({ ...current, targetAmount: event.target.value }))} placeholder="100000" />
          </label>
          <label className="field">
            <span>Şu an biriken</span>
            <input inputMode="decimal" value={goalForm.currentAmount} onChange={(event) => setGoalForm((current) => ({ ...current, currentAmount: event.target.value }))} placeholder="0" />
          </label>
          <label className="field">
            <span>Son tarih</span>
            <input type="date" value={goalForm.deadline} onChange={(event) => setGoalForm((current) => ({ ...current, deadline: event.target.value }))} />
          </label>
          <button className="secondary-button" disabled={pending === "goal"} type="submit">
            <Plus size={16} />
            {pending === "goal" ? "Ekleniyor" : "Hedef ekle"}
          </button>
        </div>
        <ProfileRows rows={goals.map((goal) => ({ id: goal.id, title: goal.title, meta: `${formatMoney(goal.currentAmount, currency)} / ${formatMoney(goal.targetAmount, currency)} · ${goal.deadline}` }))} onDelete={(id) => void removeGoal(id)} />
      </form>

      {status ? <p className={`form-message ${status.tone === "error" ? "danger" : "success-message"}`}>{status.text}</p> : null}
    </section>
  );
}

function ProfileStat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <article className="detail-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}

function ProfileRows({ rows, onDelete }: { rows: Array<{ id: string; title: string; meta: string }>; onDelete: (id: string) => void }) {
  if (!rows.length) return <div className="empty-state">Kayıt yok.</div>;
  return (
    <div className="profile-row-list">
      {rows.map((row) => (
        <article className="profile-row" key={row.id}>
          <div>
            <strong>{row.title}</strong>
            <span>{row.meta}</span>
          </div>
          <button className="ghost-icon" type="button" onClick={() => onDelete(row.id)} aria-label={`${row.title} sil`}>
            <Trash2 size={15} />
          </button>
        </article>
      ))}
    </div>
  );
}

function categoryLabel(categories: Category[], categoryId: string) {
  return categories.find((category) => category.id === categoryId)?.name ?? categoryId;
}

function formatMoney(value: number, currency: Currency) {
  return formatCurrency(value, currency, { maximumFractionDigits: 2 });
}
