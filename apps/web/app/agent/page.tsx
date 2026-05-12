import { AppShell } from "../../components/app-shell";
import { AgentConsole } from "../../components/agent-console";
import { requirePersonalSession } from "../../lib/server-auth";

export default async function AgentPage() {
  const { user } = await requirePersonalSession();
  return (
    <AppShell active="/agent" accountType={user.accountType}>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">LangGraph Agentic Finans Ekibi</p>
          <h1>Supervisor agent doğru finans uzmanını seçer.</h1>
        </div>
      </header>
      <AgentConsole />
    </AppShell>
  );
}
