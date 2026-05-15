import { Plus, RefreshCw } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { InvestmentPortfolio } from "../../components/investment-portfolio";
import { getInvestmentPortfolio, getPlanningOverview } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { token, user } = await requirePersonalSession();
  const [investmentPortfolio, planning] = await Promise.all([getInvestmentPortfolio({ token }), getPlanningOverview({ token })]);

  return (
    <AppShell active="/portfolio" accountType="personal" displayName={user.name}>
      <section className="image-page portfolio-image-page">
      <header className="image-page-header portfolio-top-reference">
        <div>
          <h1>Portföy</h1>
          <p>Varlıklarını, getirilerini ve riskini tek bakışta yönet.</p>
        </div>
        <div className="portfolio-header-actions">
          <span className="live-dot">Piyasa verisi: Canlı</span>
          <a className="icon-shell-button" href="/portfolio" aria-label="Yenile"><RefreshCw size={17} /></a>
          <a className="primary-button-like" href="/portfolio/add"><Plus size={17} /> Varlık Ekle</a>
        </div>
      </header>

      <InvestmentPortfolio initialPortfolio={investmentPortfolio} goals={planning.goals} />
      </section>
    </AppShell>
  );
}
