import { Repeat2 } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { SubscriptionHunterDetailPanel } from "../../components/insight-detail-panels";
import { SubscriptionManager } from "../../components/subscription-manager";
import { getCategories, getSubscriptionLeaks, getSubscriptions } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const { token, user } = await requirePersonalSession();
  const [leaks, subscriptions, categories] = await Promise.all([getSubscriptionLeaks({ token }), getSubscriptions({ token }), getCategories({ token, kind: "expense" })]);

  return (
    <AppShell active="/subscriptions" accountType="personal" displayName={user.name}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Tekrarlı gider kontrolü</p>
          <h1>
            <Repeat2 size={30} />
            Akıllı Abonelik Avcısı
          </h1>
          <p className="header-subtitle">Kullanılmayan, tekrarlı veya fiyatı artmış abonelikleri aylık etkisiyle birlikte incele.</p>
        </div>
      </header>

      <SubscriptionHunterDetailPanel leaks={leaks} />
      <SubscriptionManager initialSubscriptions={subscriptions} leaks={leaks} categories={categories} />
    </AppShell>
  );
}
