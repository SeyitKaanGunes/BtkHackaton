import { AppShell } from "../../components/app-shell";
import { BusinessWorkspace, type BusinessSectionId, type BusinessWorkspaceData } from "../../components/business-workspace";
import { getBusinessCustomers, getBusinessDashboard, getBusinesses, getCollectionScore } from "../../lib/api";
import { requireBusinessSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

type BusinessPageProps = {
  searchParams?: Promise<{ section?: string }>;
};

export default async function BusinessPage({ searchParams }: BusinessPageProps) {
  const { token, user } = await requireBusinessSession();
  const params = await searchParams;
  const section = parseBusinessSection(params?.section);
  const showOverview = params?.section === undefined;
  const businessData = await loadBusinessData(token);
  const active = params?.section ? `/business?section=${section}` : "/business";
  return (
    <AppShell active={active} accountType={user.accountType}>
      <BusinessWorkspace initialData={businessData} activeSection={section} showOverview={showOverview} />
    </AppShell>
  );
}

async function loadBusinessData(token: string): Promise<BusinessWorkspaceData | null> {
  const [business] = await getBusinesses({ token });
  if (!business) return null;

  const [dashboard, customers] = await Promise.all([getBusinessDashboard(business.id, { token }), getBusinessCustomers(business.id, { token })]);
  const scores = await Promise.all(customers.map((customer) => getCollectionScore(business.id, customer.id, { token })));
  return { business, dashboard, customers, scores };
}

function parseBusinessSection(section: string | undefined): BusinessSectionId {
  if (section === "cashflow" || section === "coverage" || section === "collections" || section === "scenarios" || section === "records") return section;
  return "twin";
}
