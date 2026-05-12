"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarClock, Check, Plus, Wallet, X } from "lucide-react";
import type { ActionItem, Category, Currency, TransactionType } from "@fintwin/shared";
import { approveAction, createTransaction, dismissAction, getCategories, updateFinanceProfile, type AuthUserProfile } from "../lib/api";
import { localDateInputValue, parseMoneyInput } from "../lib/input-format";

const currencies: Currency[] = ["TRY", "USD", "EUR"];

type Status = { tone: "ok" | "error"; text: string } | null;

export function ManualTransactionPanel({ initialUser }: { initialUser: AuthUserProfile }) {
  const router = useRouter();
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState("cat-other");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [occurredAt, setOccurredAt] = useState(() => localDateInputValue());
  const [recurring, setRecurring] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [salaryAmount, setSalaryAmount] = useState(initialUser.monthlyIncome > 0 ? String(initialUser.monthlyIncome) : "");
  const [payday, setPayday] = useState(String(initialUser.payday));
  const [salaryCurrency, setSalaryCurrency] = useState<Currency>(initialUser.currency as Currency);
  const [salaryPending, setSalaryPending] = useState(false);
  const [salaryStatus, setSalaryStatus] = useState<Status>(null);
  const categoryOptions = useMemo(() => categories.filter((category) => category.kind === type), [categories, type]);

  useEffect(() => {
    setCategoryLoadError(null);
    void getCategories()
      .then((items) => setCategories(items))
      .catch((error) => {
        setCategories([]);
        setCategoryLoadError(error instanceof Error ? error.message : "Kategori listesi alınamadı.");
      });
  }, []);

  useEffect(() => {
    if (!categoryOptions.length) return;
    if (!categoryOptions.some((option) => option.id === categoryId)) {
      setCategoryId(categoryOptions[0]?.id ?? "");
    }
  }, [categoryId, categoryOptions]);

  async function submitSalary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedSalary = parseMoneyInput(salaryAmount);
    const parsedPayday = Number(payday);
    if (parsedSalary === undefined || parsedSalary < 0 || !Number.isInteger(parsedPayday) || parsedPayday < 1 || parsedPayday > 31) {
      setSalaryStatus({ tone: "error", text: "Maaş sıfır veya pozitif, ödeme günü 1-31 arasında olmalı." });
      return;
    }

    setSalaryPending(true);
    setSalaryStatus(null);
    try {
      await updateFinanceProfile({
        monthlyIncome: parsedSalary,
        payday: parsedPayday,
        currency: salaryCurrency
      });
      setSalaryStatus({ tone: "ok", text: "Maaş planı kaydedildi. Günü geldiyse bakiye güncellendi." });
      router.refresh();
    } catch (error) {
      setSalaryStatus({ tone: "error", text: error instanceof Error ? error.message : "Maaş planı kaydedilemedi." });
    } finally {
      setSalaryPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = parseMoneyInput(amount);
    const customCategory = newCategoryName.trim();
    if (categoryLoadError && !customCategory) {
      setStatus({ tone: "error", text: "Kategori listesi alınamadı. Yeni kategori adı gir veya sayfayı yenile." });
      return;
    }
    if (!merchant.trim() || parsedAmount === undefined || parsedAmount <= 0 || (!categoryId && !customCategory)) {
      setStatus({ tone: "error", text: "Açıklama, kategori ve pozitif tutar gerekli." });
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      await createTransaction({
        merchant: merchant.trim(),
        amount: parsedAmount,
        type,
        categoryId: customCategory ? undefined : categoryId,
        categoryName: customCategory || undefined,
        currency,
        occurredAt: `${occurredAt}T12:00:00.000Z`,
        paymentMethod: type === "income" ? "transfer" : "debit_card",
        recurring
      });
      setMerchant("");
      setAmount("");
      setNewCategoryName("");
      setRecurring(false);
      setStatus({ tone: "ok", text: "İşlem eklendi." });
      if (customCategory) {
        void getCategories()
          .then((items) => {
            setCategories(items);
            setCategoryLoadError(null);
          })
          .catch((error) => setCategoryLoadError(error instanceof Error ? error.message : "Kategori listesi alınamadı."));
      }
      router.refresh();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "İşlem eklenemedi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="panel manual-transaction-panel">
      <div className="section-title">
        <span>Gelir ve gider akışı</span>
        <strong>maaş / manuel işlem</strong>
      </div>
      <div className="manual-panel-grid">
        <form className="salary-profile-form" onSubmit={submitSalary}>
          <div className="mini-form-heading">
            <Wallet size={17} />
            <span>Aylık maaş</span>
          </div>
          <label className="field">
            <span>Maaş tutarı</span>
            <input value={salaryAmount} onChange={(event) => setSalaryAmount(event.target.value)} inputMode="decimal" placeholder="45000" />
          </label>
          <label className="field">
            <span>Her ay günü</span>
            <input value={payday} onChange={(event) => setPayday(event.target.value)} inputMode="numeric" placeholder="5" />
          </label>
          <label className="field">
            <span>Para birimi</span>
            <select value={salaryCurrency} onChange={(event) => setSalaryCurrency(event.target.value as Currency)}>
              {currencies.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" type="submit" disabled={salaryPending}>
            <CalendarClock size={16} />
            {salaryPending ? "Kaydediliyor" : "Maaşı kaydet"}
          </button>
          {salaryStatus ? <p className={`form-message ${salaryStatus.tone === "error" ? "danger" : "success-message"}`}>{salaryStatus.text}</p> : null}
        </form>

        <form className="manual-transaction-form" onSubmit={submit}>
          <label className="field">
            <span>Satıcı veya açıklama</span>
            <input value={merchant} onChange={(event) => setMerchant(event.target.value)} required placeholder="Migros, kira, fatura" />
          </label>
          <label className="field">
            <span>Tutar</span>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} required inputMode="decimal" placeholder="1250" />
          </label>
          <div className="segmented-tabs transaction-kind-tabs" aria-label="İşlem tipi">
            {(["expense", "income"] as const).map((item) => (
              <button className={type === item ? "active" : ""} key={item} onClick={() => setType(item)} type="button">
                {item === "expense" ? "Gider" : "Gelir"}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Tarih</span>
            <input value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required type="date" />
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
          <div className="category-picker" aria-label="Kategori">
            {categoryOptions.map((item) => (
              <button className={categoryId === item.id && !newCategoryName.trim() ? "active" : ""} key={item.id} onClick={() => setCategoryId(item.id)} type="button">
                {item.name}
              </button>
            ))}
          </div>
          {categoryLoadError ? <p className="form-message danger">{categoryLoadError}</p> : null}
          <label className="field custom-category-field">
            <span>Yeni kategori</span>
            <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Örn. okul, spor" />
          </label>
          <label className="inline-toggle recurring-toggle">
            <input checked={recurring} onChange={(event) => setRecurring(event.target.checked)} type="checkbox" />
            <span>Tekrar eden işlem</span>
          </label>
          <button className="secondary-button manual-transaction-submit" type="submit" disabled={pending}>
            <Plus size={16} />
            {pending ? "Ekleniyor" : "İşlem ekle"}
          </button>
        </form>
      </div>
      {status ? <p className={`form-message ${status.tone === "error" ? "danger" : "success-message"}`}>{status.text}</p> : null}
    </div>
  );
}

export function ActionCenterPanel({ initialActions }: { initialActions: ActionItem[] }) {
  const router = useRouter();
  const [actions, setActions] = useState(initialActions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActions(initialActions);
  }, [initialActions]);

  async function update(action: ActionItem, decision: "approve" | "dismiss") {
    setPendingId(action.id);
    setError(null);
    try {
      const updated = decision === "approve" ? await approveAction(action.id) : await dismissAction(action.id);
      setActions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksiyon güncellenemedi.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">
        <span>Finansal Aksiyon Merkezi</span>
        <span className="chip warn">{actions.length} açık aksiyon</span>
      </div>
      {actions.length ? (
        <div className="action-list">
          {actions.map((action) => (
            <article className="dashboard-action-card" key={action.id}>
              <div className="dashboard-action-icon">
                <Bell size={18} />
              </div>
              <div>
                <div className="dashboard-action-title">
                  <strong>{action.title}</strong>
                  <span className={`chip ${action.status === "approved" ? "success" : action.status === "dismissed" ? "danger" : "accent"}`}>{actionStatusLabel(action.status)}</span>
                </div>
                <p>{action.description}</p>
                <small>{action.dueAt ? formatShortDate(action.dueAt) : "aktivasyon bekliyor"}</small>
              </div>
              {action.status === "pending" ? (
                <div className="dashboard-action-buttons">
                  <button className="secondary-button small-button" type="button" onClick={() => void update(action, "approve")} disabled={Boolean(pendingId)}>
                    <Check size={15} />
                    {pendingId === action.id ? "İşleniyor" : "Onayla"}
                  </button>
                  <button className="secondary-button small-button danger-button" type="button" onClick={() => void update(action, "dismiss")} disabled={Boolean(pendingId)}>
                    <X size={15} />
                    Reddet
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">Onay bekleyen finansal aksiyon yok.</div>
      )}
      {error ? <p className="form-message danger">{error}</p> : null}
    </div>
  );
}

function actionStatusLabel(status: ActionItem["status"]) {
  if (status === "approved") return "Onaylandı";
  if (status === "dismissed") return "Reddedildi";
  return "Bekliyor";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(value));
}

