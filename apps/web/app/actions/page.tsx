import { ListChecks } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { ActionCenterPanel } from "../../components/dashboard-actions";
import { getActions } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  const { token, user } = await requirePersonalSession();
  const actions = await getActions({ token });
  const pendingCount = actions.filter((action) => action.status === "pending").length;
  const approvedCount = actions.filter((action) => action.status === "approved").length;
  const dismissedCount = actions.filter((action) => action.status === "dismissed").length;

  return (
    <AppShell active="/actions" accountType={user.accountType}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Karar ve takip</p>
          <h1>
            <ListChecks size={30} />
            Finansal Aksiyon Merkezi
          </h1>
          <p className="header-subtitle">Sistem ve agent tarafından üretilen aksiyonları burada onayla, reddet veya takip et.</p>
        </div>
      </header>

      <section className="insight-grid three">
        <article className="detail-stat-card">
          <span>Bekleyen</span>
          <strong>{pendingCount}</strong>
          <small>Karar bekleyen aksiyonlar.</small>
        </article>
        <article className="detail-stat-card">
          <span>Onaylanan</span>
          <strong>{approvedCount}</strong>
          <small>Takibe alınan öneriler.</small>
        </article>
        <article className="detail-stat-card">
          <span>Reddedilen</span>
          <strong>{dismissedCount}</strong>
          <small>Kullanıcı tarafından kapatılanlar.</small>
        </article>
      </section>

      <ActionCenterPanel initialActions={actions} />
    </AppShell>
  );
}
