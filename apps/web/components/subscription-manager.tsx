"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Eye, EyeOff, Plus, XCircle } from "lucide-react";
import type { Category, Currency, Subscription, SubscriptionLeak, SubscriptionStatus } from "@fintwin/shared";
import { createSubscription, updateSubscription } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { localDateInputValue, parseMoneyInput } from "../lib/input-format";

const statusOptions: Array<{ value: SubscriptionStatus; label: string }> = [
  { value: "active", label: "Aktif" },
  { value: "watching", label: "İzleniyor" },
  { value: "cancelled", label: "İptal edildi" },
  { value: "ignored", label: "Yok sayıldı" }
];

export function SubscriptionManager({ initialSubscriptions, leaks, categories }: { initialSubscriptions: Subscription[]; leaks: SubscriptionLeak[]; categories: Category[] }) {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    merchant: "",
    amount: "",
    categoryId: categories.find((category) => category.id === "cat-subscription")?.id ?? categories[0]?.id ?? "",
    currency: "TRY" as Currency,
    cadence: "monthly" as Subscription["cadence"],
    nextExpectedAt: localDateInputValue()
  });
  const leakBySubscription = useMemo(() => new Map(leaks.map((leak) => [leak.subscriptionId, leak])), [leaks]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoneyInput(form.amount);
    if (!form.merchant.trim() || amount === undefined || amount <= 0 || !form.categoryId) {
      setError("Abonelik adı, kategori ve pozitif tutar gerekli.");
      return;
    }
    setPendingId("new");
    setError(null);
    try {
      const created = await createSubscription({
        merchant: form.merchant.trim(),
        amount,
        categoryId: form.categoryId,
        currency: form.currency,
        cadence: form.cadence,
        nextExpectedAt: form.nextExpectedAt
      });
      setSubscriptions((current) => [created, ...current]);
      setForm((current) => ({ ...current, merchant: "", amount: "", nextExpectedAt: localDateInputValue() }));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Abonelik eklenemedi.");
    } finally {
      setPendingId(null);
    }
  }

  async function setStatus(subscription: Subscription, status: SubscriptionStatus) {
    setPendingId(subscription.id);
    setError(null);
    try {
      const updated = await updateSubscription(subscription.id, { status });
      setSubscriptions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Abonelik güncellenemedi.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="panel detail-panel">
      <div className="section-title">
        <span>Abonelik yönetimi</span>
        <strong>{subscriptions.length}</strong>
      </div>
      <form className="subscription-create-form" onSubmit={submit}>
        <label className="field">
          <span>Abonelik</span>
          <input value={form.merchant} onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))} placeholder="Netflix, Spotify, bulut depolama" />
        </label>
        <label className="field">
          <span>Tutar (₺)</span>
          <input inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="149,99" />
        </label>
        <label className="field">
          <span>Kategori</span>
          <select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Dönem</span>
          <select value={form.cadence} onChange={(event) => setForm((current) => ({ ...current, cadence: event.target.value as Subscription["cadence"] }))}>
            <option value="monthly">Aylık</option>
            <option value="yearly">Yıllık</option>
          </select>
        </label>
        <label className="field">
          <span>Sonraki ödeme</span>
          <input type="date" value={form.nextExpectedAt} onChange={(event) => setForm((current) => ({ ...current, nextExpectedAt: event.target.value }))} />
        </label>
        <button className="secondary-button" disabled={pendingId === "new"} type="submit">
          <Plus size={16} />
          {pendingId === "new" ? "Ekleniyor" : "Abonelik ekle"}
        </button>
      </form>
      {subscriptions.length ? (
        <div className="subscription-management-list">
          {subscriptions.map((subscription) => {
            const leak = leakBySubscription.get(subscription.id);
            return (
              <article className="subscription-management-row" key={subscription.id}>
                <div>
                  <span className={`chip ${subscription.status === "cancelled" ? "danger" : subscription.status === "ignored" ? "warn" : "accent"}`}>{statusLabel(subscription.status)}</span>
                  <strong>{subscription.merchant}</strong>
                  <small>
                    {formatCurrency(subscription.amount, subscription.currency)}/{subscription.cadence === "yearly" ? "yıl" : "ay"}
                    {subscription.lastUsedAt ? ` · son kullanım ${subscription.lastUsedAt}` : ""}
                    {subscription.nextExpectedAt ? ` · sonraki ödeme ${subscription.nextExpectedAt}` : ""}
                  </small>
                  {leak ? <p>{leak.recommendation}</p> : null}
                </div>
                <div className="subscription-status-buttons">
                  {statusOptions.map((option) => (
                    <button
                      className={subscription.status === option.value ? "secondary-button small-button" : "secondary-button small-button voice-button"}
                      disabled={pendingId === subscription.id}
                      key={option.value}
                      onClick={() => void setStatus(subscription, option.value)}
                      type="button"
                    >
                      {iconForStatus(option.value)}
                      {option.label}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">Ekstre importlarından abonelik yakalandıkça burada yönetilebilir hale gelir.</div>
      )}
      {error ? <p className="form-message danger">{error}</p> : null}
    </section>
  );
}

function statusLabel(status: SubscriptionStatus) {
  if (status === "cancelled") return "İptal edildi";
  if (status === "ignored") return "Yok sayıldı";
  if (status === "watching") return "İzleniyor";
  return "Aktif";
}

function iconForStatus(status: SubscriptionStatus) {
  if (status === "cancelled") return <XCircle size={14} />;
  if (status === "ignored") return <EyeOff size={14} />;
  if (status === "watching") return <Eye size={14} />;
  return <Bell size={14} />;
}
