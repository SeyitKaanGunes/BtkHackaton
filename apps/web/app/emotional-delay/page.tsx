import { Clock3 } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { EmotionalDelayDetailPanel } from "../../components/insight-detail-panels";
import { getCampaignReadiness, getWhatIf } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function EmotionalDelayPage() {
  const { token, user } = await requirePersonalSession();
  const [whatIf, campaign] = await Promise.all([getWhatIf({ token }), getCampaignReadiness({ token })]);

  return (
    <AppShell active="/emotional-delay" accountType={user.accountType}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Dürtüsel harcama freni</p>
          <h1>
            <Clock3 size={30} />
            Emotional Delay
          </h1>
          <p className="header-subtitle">Riskli harcama anında kaç dakika beklemek gerektiğini ve bu önerinin hangi sinyallerden çıktığını gör.</p>
        </div>
      </header>

      <EmotionalDelayDetailPanel whatIf={whatIf} campaign={campaign} />
    </AppShell>
  );
}
