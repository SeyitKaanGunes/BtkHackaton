import { TrendingUp } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { InvestmentPortfolio } from "../../components/investment-portfolio";
import { getInvestmentPortfolio } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const investmentPortfolio = await getInvestmentPortfolio();

  return (
    <AppShell active="/portfolio">
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

      <InvestmentPortfolio initialPortfolio={investmentPortfolio} />
    </AppShell>
  );
}
