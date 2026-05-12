import type { DashboardPeriod } from "@fintwin/shared";
import { Brain } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { SpendingDnaDetailPanel } from "../../components/insight-detail-panels";
import { getSpendingDna } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

type SpendingDnaPageProps = {
  searchParams?: Promise<{ period?: string }>;
};

const periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "daily", label: "Günlük" },
  { value: "weekly", label: "Haftalık" },
  { value: "monthly", label: "Aylık" },
  { value: "yearly", label: "Yıllık" }
];

export default async function SpendingDnaPage({ searchParams }: SpendingDnaPageProps) {
  const { token, user } = await requirePersonalSession();
  const params = await searchParams;
  const period = parsePeriod(params?.period);
  const dna = await getSpendingDna({ token, period });

  return (
    <AppShell active="/spending-dna" accountType={user.accountType}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Davranışsal finans</p>
          <h1>
            <Brain size={30} />
            Spending DNA Riskleri
          </h1>
          <p className="header-subtitle">Harcama reflekslerini, kategori risklerini, veri güvenini ve eksik veri sinyallerini tek ekranda oku.</p>
        </div>
      </header>

      <PeriodTabs active={period} />
      <SpendingDnaDetailPanel dna={dna} />
    </AppShell>
  );
}

function PeriodTabs({ active }: { active: DashboardPeriod }) {
  return (
    <nav className="period-tabs" aria-label="Spending DNA dönemi">
      {periodOptions.map((option) => (
        <a className={option.value === active ? "active" : ""} href={`/spending-dna?period=${option.value}`} key={option.value}>
          {option.label}
        </a>
      ))}
    </nav>
  );
}

function parsePeriod(value: string | undefined): DashboardPeriod {
  return periodOptions.some((option) => option.value === value) ? (value as DashboardPeriod) : "monthly";
}
