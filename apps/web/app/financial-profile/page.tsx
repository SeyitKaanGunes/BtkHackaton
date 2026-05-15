import { SlidersHorizontal } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { FinancialProfilePanel } from "../../components/financial-profile";
import { getCategories, getFinancialProfile } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function FinancialProfilePage() {
  const { token, user } = await requirePersonalSession();
  const [profile, categories] = await Promise.all([getFinancialProfile({ token }), getCategories({ token })]);

  return (
    <AppShell active="/financial-profile" accountType="personal" displayName={user.name}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Finansal ikiz kurulumu</p>
          <h1>
            <SlidersHorizontal size={30} />
            Finansal Profil
          </h1>
          <p className="header-subtitle">Hesap, bütçe, hedef ve sabit giderlerini tamamladıkça Agent, What-if ve Spending DNA daha kişisel sonuç üretir.</p>
        </div>
      </header>

      <FinancialProfilePanel
        initialUser={{ monthlyIncome: user.monthlyIncome, payday: user.payday, currency: user.currency as "TRY" | "USD" | "EUR" }}
        initialAccounts={profile.accounts}
        initialBudgets={profile.budgets}
        initialGoals={profile.goals}
        categories={categories}
      />
    </AppShell>
  );
}
