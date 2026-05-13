import { Plus } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { InvestmentPortfolio } from "../../../components/investment-portfolio";
import { getInvestmentPortfolio } from "../../../lib/api";
import { requirePersonalSession } from "../../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function AddPortfolioAssetPage() {
  const { token, user } = await requirePersonalSession();
  const investmentPortfolio = await getInvestmentPortfolio({ token });

  return (
    <AppShell active="/portfolio" accountType={user.accountType}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Portföy kaydı</p>
          <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Plus size={28} />
            Varlık ekle
          </h1>
          <p className="header-subtitle">Yeni pozisyon veya banka bakiyesi ekle; ana portföy ekranı sade kalsın.</p>
        </div>
      </header>

      <InvestmentPortfolio initialPortfolio={investmentPortfolio} mode="add" />
    </AppShell>
  );
}
