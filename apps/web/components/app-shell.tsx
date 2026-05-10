import Link from "next/link";
import { Bot, Building2, Camera, LayoutDashboard, ShieldCheck } from "lucide-react";

const nav = [
  { href: "/", label: "Kişisel", icon: LayoutDashboard },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/receipt", label: "Belgeler", icon: Camera },
  { href: "/business", label: "KOBİ", icon: Building2 }
];

export function AppShell({ children, active = "/" }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">FT</span>
          <span>
            <strong>Fintwin</strong>
            <small>Decision cockpit</small>
          </span>
        </Link>
        <nav className="nav-list" aria-label="Ana navigasyon">
          {nav.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <Link className={isActive ? "nav-item active" : "nav-item"} href={item.href} key={item.href} aria-current={isActive ? "page" : undefined}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="trust-note">
          <ShieldCheck size={18} />
          <span>Model anahtarları backend tarafında kalır; kararlar kullanıcı onayıyla ilerler.</span>
        </div>
      </aside>
      <main className="workspace">{children}</main>
      <Link className="agent-fab" href="/agent" aria-label="Finansal ikiz agent paneli">
        <Bot size={22} />
        <span>İkiz</span>
      </Link>
    </div>
  );
}
