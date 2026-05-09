import { AppShell } from "../../components/app-shell";
import { AgentConsole } from "../../components/agent-console";
import { requireAuthToken } from "../../lib/server-auth";

export default async function AgentPage() {
  await requireAuthToken();
  return (
    <AppShell active="/agent">
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
