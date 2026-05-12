import { WandSparkles } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { WhatIfDetailPanel } from "../../components/insight-detail-panels";
import { getWhatIf } from "../../lib/api";
import { requireAuthSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function WhatIfPage() {
  const { token } = await requireAuthSession();
  const whatIf = await getWhatIf({ token });

  return (
    <AppShell active="/what-if">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Karar simülasyonu</p>
          <h1>
            <WandSparkles size={30} />
            What-if senaryosu
          </h1>
          <p className="header-subtitle">Güvenli, dengeli ve riskli harcama senaryolarını nakit akışı ve veri güveniyle birlikte incele.</p>
        </div>
      </header>

      <WhatIfDetailPanel whatIf={whatIf} />
    </AppShell>
  );
}
