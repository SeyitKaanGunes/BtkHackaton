import { Repeat2 } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { SubscriptionHunterDetailPanel } from "../../components/insight-detail-panels";
import { getSubscriptionLeaks } from "../../lib/api";
import { requireAuthSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const { token } = await requireAuthSession();
  const leaks = await getSubscriptionLeaks({ token });

  return (
    <AppShell active="/subscriptions">
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
    </AppShell>
  );
}
