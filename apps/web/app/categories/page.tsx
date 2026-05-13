import type { DashboardPeriod } from "@fintwin/shared";
import { BarChart3 } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { CategoryDistributionDetailPanel } from "../../components/insight-detail-panels";
import { getPersonalDashboard } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

type CategoriesPageProps = {
  searchParams?: Promise<{ period?: string }>;
};

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "daily", label: "Günlük" },
  { value: "weekly", label: "Haftalık" },
  { value: "monthly", label: "Aylık" },
  { value: "yearly", label: "Yıllık" }
];

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const { token, user } = await requirePersonalSession();
  const params = await searchParams;
  const period = parsePeriod(params?.period);
  const dashboard = await getPersonalDashboard({ token, period });

  return (
    <AppShell active="/categories" accountType={user.accountType}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Harcama analizi</p>
          <h1>
            <BarChart3 size={30} />
            Kategori Dağılımı
          </h1>
          <p className="header-subtitle">Bu dönemki harcamaları kategori bazında, pay oranı ve toplam etkiyle birlikte incele.</p>
        </div>
      </header>

      <PeriodTabs active={period} />
      <CategoryDistributionDetailPanel dashboard={dashboard} />
    </AppShell>
  );
}

function PeriodTabs({ active }: { active: DashboardPeriod }) {
  return (
    <nav className="period-tabs" aria-label="Kategori dönemi">
      {periodOptions.map((option) => (
        <a className={option.value === active ? "active" : ""} href={`/categories?period=${option.value}`} key={option.value}>
          {option.label}
        </a>
      ))}
    </nav>
  );
}

function parsePeriod(value: string | undefined): DashboardPeriod {
  return periodOptions.some((option) => option.value === value) ? (value as DashboardPeriod) : "monthly";
}
