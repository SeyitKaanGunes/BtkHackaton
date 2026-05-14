import Link from "next/link";
import { ArrowRightLeft, BarChart3, Bot, Brain, Building2, CalendarPlus, CheckCircle2, Clock3, Fingerprint, LayoutDashboard, ListChecks, MessageSquareText, Repeat2, ShieldCheck, SlidersHorizontal, Sparkles, Target, TrendingUp, WandSparkles } from "lucide-react";
import { AgentLauncher } from "./agent-launcher";
import { LogoutButton } from "./logout-button";

type AccountType = "personal" | "business";

const personalNav = [
  { href: "/", label: "Özet", icon: LayoutDashboard },
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
  { href: "/business", label: "KOBİ", icon: Building2 },
  { href: "/business?section=twin", label: "Finansal İkiz", icon: Sparkles },
  { href: "/business?section=dna", label: "İşletme DNA", icon: Fingerprint },
  { href: "/business?section=cashflow", label: "Nakit Akışı", icon: TrendingUp },
  { href: "/business?section=coverage", label: "Maaş ve Kira", icon: CheckCircle2 },
  { href: "/business?section=collections", label: "Tahsilat", icon: MessageSquareText },
  { href: "/business?section=scenarios", label: "Senaryolar", icon: ArrowRightLeft },
  { href: "/business?section=records", label: "Veri Girişi", icon: CalendarPlus }
];

export function AppShell({
  children,
  active = "/",
  accountType = "personal",
  businessReady = true
}: {
  children: React.ReactNode;
  active?: string;
  accountType?: AccountType;
  businessReady?: boolean;
}) {
  const nav = accountType === "business" ? (businessReady ? businessNav : businessNav.slice(0, 1)) : personalNav;
  const homeHref = accountType === "business" ? "/business" : "/";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={homeHref}>
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
      <AgentLauncher
        ariaLabel={accountType === "business" ? "KOBİ asistanını aç" : "Agent sayfasına git"}
        href={accountType === "business" ? "/business?section=assistant" : "/agent"}
        mode={accountType === "business" ? "link" : "modal"}
      />
    </div>
  );
}
