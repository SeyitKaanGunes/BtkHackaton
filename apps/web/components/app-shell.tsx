import Link from "next/link";
import {
  BarChart3,
  Bell,
  Bot,
  Brain,
  Building2,
  CircleHelp,
  Clock3,
  Fingerprint,
  LayoutDashboard,
  ListChecks,
  Repeat2,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  WandSparkles
} from "lucide-react";
import { AgentLauncher } from "./agent-launcher";
import { LogoutButton } from "./logout-button";

type AccountType = "personal" | "business";

const personalNav = [
  { href: "/dashboard", label: "Özet", icon: LayoutDashboard },
  { href: "/financial-profile", label: "Finansal Profil", icon: SlidersHorizontal },
  { href: "/categories", label: "Kategori Dağılımı", icon: BarChart3 },
  { href: "/spending-dna", label: "Spending DNA", icon: Brain },
  { href: "/what-if", label: "What-if", icon: WandSparkles },
  { href: "/goals", label: "Hedefler", icon: Target },
  { href: "/emotional-delay", label: "Emotional Delay", icon: Clock3 },
  { href: "/actions", label: "Aksiyon Merkezi", icon: ListChecks },
  { href: "/subscriptions", label: "Abonelik Avcısı", icon: Repeat2 },
  { href: "/portfolio", label: "Portföy", icon: TrendingUp },
  { href: "/agent", label: "Agent", icon: Bot }
];

const businessNav = [
  { href: "/business", label: "Genel Bakış", icon: Building2 },
  { href: "/business?section=twin", label: "Finansal İkiz", icon: Sparkles },
  { href: "/business?section=dna", label: "İşletme DNA", icon: Fingerprint },
  { href: "/business?section=cashflow", label: "Nakit Akışı", icon: TrendingUp },
  { href: "/business?section=coverage", label: "Maaş ve Kira", icon: Target },
  { href: "/business?section=collections", label: "Tahsilat", icon: ListChecks },
  { href: "/business?section=scenarios", label: "Senaryolar", icon: WandSparkles },
  { href: "/business?section=records", label: "Kayıtlar", icon: BarChart3 },
  { href: "/business?section=assistant", label: "KOBİ Asistanı", icon: Brain }
];

export function AppShell({
  children,
  active = "/dashboard",
  accountType = "personal",
  businessReady = true,
  displayName
}: {
  children: React.ReactNode;
  active?: string;
  accountType?: AccountType;
  businessReady?: boolean;
  displayName?: string;
}) {
  const nav = accountType === "business" ? (businessReady ? businessNav : businessNav.slice(0, 1)) : personalNav;
  const homeHref = accountType === "business" ? "/business" : "/dashboard";
  const accountLabel = accountType === "business" ? "KOBİ Hesabı" : "Kişisel Hesap";
  const shownName = displayName ?? (accountType === "business" ? "KOBİ alanı" : "Kişisel alan");
  const initials = shownName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
    .join("");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={homeHref}>
          <span className="brand-mark image-brand-mark">
            <img src="/fintwin-logo.png" alt="" />
          </span>
          <span>
            <strong>Fintwin</strong>
            <small>{accountType === "business" ? "KOBİ çalışma alanı" : "Finansal ikiziniz"}</small>
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
      </aside>
      <div className="shell-content">
        <header className="app-topbar" aria-label="Uygulama üst barı">
          <label className="global-search">
            <Search size={17} />
            <input placeholder="Ara: işlem, hesap, kategori..." aria-label="Uygulamada ara" />
          </label>
          <div className="topbar-actions">
            <nav className="account-switcher" aria-label="Hesap alanı değiştir">
              <Link className={accountType === "personal" ? "active" : ""} href="/dashboard">
                Kişisel
              </Link>
              <Link className={accountType === "business" ? "active" : ""} href="/business">
                KOBİ
              </Link>
            </nav>
            <Link className="topbar-icon-button" href="/actions" aria-label="Bildirimler">
              <Bell size={18} />
              <span />
            </Link>
            <Link className="topbar-icon-button" href="/agent" aria-label="Yardım">
              <CircleHelp size={18} />
            </Link>
            <div className="topbar-user">
              <span>{initials || "F"}</span>
              <div>
                <strong>{shownName}</strong>
                <small>{accountLabel}</small>
              </div>
            </div>
          </div>
        </header>
        <main className="workspace">{children}</main>
      </div>
      <AgentLauncher ariaLabel="Agent sayfasına git" href="/agent" />
    </div>
  );
}
