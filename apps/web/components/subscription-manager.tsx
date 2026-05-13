"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Eye, EyeOff, XCircle } from "lucide-react";
import type { Subscription, SubscriptionLeak, SubscriptionStatus } from "@fintwin/shared";
import { updateSubscription } from "../lib/api";

const statusOptions: Array<{ value: SubscriptionStatus; label: string }> = [
  { value: "active", label: "Aktif" },
  { value: "watching", label: "İzleniyor" },
  { value: "cancelled", label: "İptal edildi" },
  { value: "ignored", label: "Yok sayıldı" }
];

export function SubscriptionManager({ initialSubscriptions, leaks }: { initialSubscriptions: Subscription[]; leaks: SubscriptionLeak[] }) {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const leakBySubscription = useMemo(() => new Map(leaks.map((leak) => [leak.subscriptionId, leak])), [leaks]);

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
                    {subscription.amount.toLocaleString("tr-TR")} {subscription.currency} / {subscription.cadence === "yearly" ? "yıl" : "ay"}
                    {subscription.lastUsedAt ? ` · son kullanım ${subscription.lastUsedAt}` : ""}
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
