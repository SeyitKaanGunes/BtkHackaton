import Link from "next/link";
import { BarChart3, Bot, Brain, Building2, Clock3, LayoutDashboard, ListChecks, Repeat2, ShieldCheck, TrendingUp, WandSparkles } from "lucide-react";
import { AgentLauncher } from "./agent-launcher";
import { LogoutButton } from "./logout-button";

const nav = [
  { href: "/", label: "Özet", icon: LayoutDashboard },
  { href: "/categories", label: "Kategori Dağılımı", icon: BarChart3 },
  { href: "/spending-dna", label: "Spending DNA", icon: Brain },
  { href: "/what-if", label: "What-if", icon: WandSparkles },
  { href: "/emotional-delay", label: "Emotional Delay", icon: Clock3 },
  { href: "/actions", label: "Aksiyon Merkezi", icon: ListChecks },
  { href: "/subscriptions", label: "Abonelik Avcısı", icon: Repeat2 },
  { href: "/portfolio", label: "Portföy", icon: TrendingUp },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/business", label: "KOBİ", icon: Building2 }
];

export function AppShell({ children, active = "/" }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">FS</span>
          <span>
            <strong>Fintwin</strong>
            <small>AI Financial Twin</small>
          </span>
        </Link>
        <nav className="nav-list" aria-label="Ana navigasyon">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link className={active === item.href ? "nav-item active" : "nav-item"} href={item.href} key={item.href}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <LogoutButton />
        <div className="trust-note">
          <ShieldCheck size={18} />
          <span>Qwen/Gemini anahtarları yalnızca backend tarafında kalır.</span>
        </div>
      </aside>
      <main className="workspace">{children}</main>
      <AgentLauncher />
    </div>
  );
}
