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
        <div className="trust-note">
          <ShieldCheck size={18} />
          <span>Qwen/Gemini anahtarları yalnızca backend tarafında kalır.</span>
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
