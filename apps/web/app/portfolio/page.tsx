import { TrendingUp } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { InvestmentPortfolio } from "../../components/investment-portfolio";
import { getInvestmentPortfolio, getPlanningOverview } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { token, user } = await requirePersonalSession();
  const [investmentPortfolio, planning] = await Promise.all([getInvestmentPortfolio({ token }), getPlanningOverview({ token })]);

  return (
    <AppShell active="/portfolio" accountType={user.accountType}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Yatırım</p>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={28} />
            Portföy
          </h1>
          <p className="header-subtitle">Hisse, döviz, altın, kripto ve mevduat pozisyonlarını tek panelde takip et.</p>
        </div>
      </header>

      <InvestmentPortfolio initialPortfolio={investmentPortfolio} goals={planning.goals} />
    </AppShell>
  );
}
