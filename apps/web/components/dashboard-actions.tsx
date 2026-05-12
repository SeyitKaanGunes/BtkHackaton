"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Plus, X } from "lucide-react";
import type { ActionItem, Currency, TransactionType } from "@fintwin/shared";
import { approveAction, createTransaction, dismissAction } from "../lib/api";

const expenseTransactionCategories = [
  { id: "cat-market", label: "Market" },
  { id: "cat-food", label: "Yemek" },
  { id: "cat-transport", label: "Ulaşım" },
  { id: "cat-tech", label: "Teknoloji" },
  { id: "cat-clothes", label: "Giyim" },
  { id: "cat-subscription", label: "Abonelik" },
  { id: "cat-rent", label: "Kira" },
  { id: "cat-other", label: "Diğer" }
];

const incomeTransactionCategories = [{ id: "cat-salary", label: "Maaş" }];
const currencies: Currency[] = ["TRY", "USD", "EUR"];

type Status = { tone: "ok" | "error"; text: string } | null;

export function ManualTransactionPanel() {
  const router = useRouter();
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState("cat-other");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const categoryOptions = type === "income" ? incomeTransactionCategories : expenseTransactionCategories;

  useEffect(() => {
    if (!categoryOptions.some((option) => option.id === categoryId)) {
      setCategoryId(categoryOptions[0]?.id ?? "");
    }
  }, [categoryId, categoryOptions]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = parseMoneyInput(amount);
    if (!merchant.trim() || parsedAmount === undefined || parsedAmount <= 0) {
      setStatus({ tone: "error", text: "Satıcı/açıklama ve pozitif tutar gerekli." });
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      await createTransaction({
        merchant: merchant.trim(),
        amount: parsedAmount,
        type,
        categoryId,
        currency,
        occurredAt: `${occurredAt}T12:00:00.000Z`,
        paymentMethod: type === "income" ? "transfer" : "debit_card"
      });
      setMerchant("");
      setAmount("");
      setStatus({ tone: "ok", text: "İşlem eklendi." });
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
        <span>Manuel işlem</span>
        <strong>gelir / gider</strong>
      </div>
      <form className="manual-transaction-form" onSubmit={submit}>
        <label className="field">
          <span>Satıcı veya açıklama</span>
          <input value={merchant} onChange={(event) => setMerchant(event.target.value)} required placeholder="Migros, maaş, kira" />
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
            <button className={categoryId === item.id ? "active" : ""} key={item.id} onClick={() => setCategoryId(item.id)} type="button">
              {item.label}
            </button>
          ))}
        </div>
        <button className="secondary-button manual-transaction-submit" type="submit" disabled={pending}>
          <Plus size={16} />
          {pending ? "Ekleniyor" : "İşlem ekle"}
        </button>
      </form>
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

function parseMoneyInput(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
