import { AppShell } from "../../components/app-shell";
import { AgentConsole } from "../../components/agent-console";
import { requirePersonalSession } from "../../lib/server-auth";

export default async function AgentPage() {
  const { user } = await requirePersonalSession();
  return (
    <AppShell active="/agent" accountType="personal" displayName={user.name}>
      <section className="image-page agent-image-page">
        <header className="image-page-header">
          <div>
            <h1>AI İkiz</h1>
            <p>Finansal ikizinizle konuşun, birlikte daha iyi kararlar alın.</p>
          </div>
          <a className="primary-button-like" href="/agent">Yeni Sohbet</a>
        </header>
        <div className="agent-reference-grid">
          <main className="agent-reference-main">
            <nav className="image-tabs compact-tabs" aria-label="AI İkiz sekmeleri">
              <a className="active" href="/agent">Sohbet</a>
              <a href="/spending-dna">Analizler</a>
            </nav>
            <AgentConsole />
          </main>
        </div>
      </section>
    </AppShell>
  );
}
