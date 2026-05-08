import { AppShell } from "../../components/app-shell";
import { AgentConsole } from "../../components/agent-console";

export default function AgentPage() {
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
