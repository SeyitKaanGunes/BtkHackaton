import { Clock3 } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { EmotionalDelaySimulator } from "../../components/decision-simulator";
import { getCampaignReadiness, getWhatIf } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function EmotionalDelayPage() {
  const { token, user } = await requirePersonalSession();
  const [whatIf, campaign] = await Promise.all([getWhatIf({ token }), getCampaignReadiness({ token })]);

  return (
    <AppShell active="/emotional-delay" accountType="personal" displayName={user.name}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Karar molası</p>
          <h1>
            <Clock3 size={30} />
            Emotional Delay
          </h1>
          <p className="header-subtitle">Bir harcama kararının bütçe, nakit akışı ve kampanya hassasiyeti üzerindeki etkisini kısa bir bekleme önerisiyle birlikte gör.</p>
        </div>
      </header>

      <EmotionalDelaySimulator initialWhatIf={whatIf} campaign={campaign} />
    </AppShell>
  );
}
