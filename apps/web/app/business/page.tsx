import { AppShell } from "../../components/app-shell";
import { BusinessWorkspace, type BusinessWorkspaceData } from "../../components/business-workspace";
import { getBusinessCustomers, getBusinessDashboard, getBusinesses, getCollectionScore } from "../../lib/api";
import { requireAuthSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  const { token } = await requireAuthSession();
  const businessData = await loadBusinessData(token);
  return (
    <AppShell active="/business">
      <BusinessWorkspace initialData={businessData} />
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
