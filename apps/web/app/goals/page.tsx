import { Target } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { GoalsPlanner } from "../../components/goals-planner";
import { getPlanningOverview } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const { token, user } = await requirePersonalSession();
  const planning = await getPlanningOverview({ token });

  return (
    <AppShell active="/goals" accountType="personal" displayName={user.name}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Hedef ve limit planı</p>
          <h1>
            <Target size={30} />
            Hedefler
          </h1>
          <p className="header-subtitle">Kendi hedefini, aylık/yıllık birikim planını ve kategori bazlı harcama limitlerini buradan kalıcı olarak yönet.</p>
        </div>
      </header>

      <GoalsPlanner initialPlanning={planning} />
    </AppShell>
  );
}
