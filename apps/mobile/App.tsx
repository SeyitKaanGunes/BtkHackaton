import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Brain,
  Building2,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock3,
  FileScan,
  Fingerprint,
  Landmark,
  ListChecks,
  LogOut,
  Menu,
  PauseCircle,
  Plus,
  Repeat2,
  ShieldAlert,
  Sparkles,
  Target,
  ReceiptText,
  UserPlus,
  WalletCards,
  X
} from "lucide-react-native";
import type {
  ActionItem,
  AiCfoSimulation,
  Business,
  BusinessCustomer,
  BusinessDashboard,
  Category,
  CollectionScore,
  Currency,
  DashboardPeriod,
  DashboardSummary,
  Goal,
  ScenarioCard,
  SpendingDna,
  SubscriptionLeak,
  TransactionType,
  WhatIfResponse
} from "@fintwin/shared";
import {
  approveAction,
  clearAuthToken,
  createBusiness,
  createBusinessCashEvent,
  createBusinessCustomer,
  createTransaction,
  dismissAction,
  getBiometricAuthLabel,
  hasAuthToken,
  loadBusiness,
  loadCategories,
  loadMobileHome,
  loadStoredAuthToken,
  login,
  persistAuthToken,
  register,
  simulateBusinessDecision,
  updateFinanceProfile,
  type AuthUserProfile
} from "./src/api";
import { AgentScreen } from "./src/screens/AgentScreen";
import { PortfolioScreen } from "./src/screens/PortfolioScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { Badge, Button, Gauge as ScoreGauge, IconButton, MetricCard, Mono, Panel, ProgressBar, RiskBar, ScreenHeader, SectionTitle, palette, styles, typefaces } from "./src/ui";

type MobileSection = "overview" | "categories" | "spendingDna" | "whatIf" | "emotionalDelay" | "actions" | "subscriptions" | "portfolio" | "business" | "agent";
type HomeSection = Exclude<MobileSection, "portfolio" | "business" | "agent">;
type NavIcon = typeof WalletCards;
type HomeData = Awaited<ReturnType<typeof loadMobileHome>>;
type BusinessData = NonNullable<Awaited<ReturnType<typeof loadBusiness>>>;

const agentPet = require("./src/assets/agent-pet.png");

const mobileNavItems: Array<{ id: Exclude<MobileSection, "agent">; label: string; caption: string; Icon: NavIcon }> = [
  { id: "overview", label: "Özet", caption: "Ana finansal durum", Icon: WalletCards },
  { id: "categories", label: "Kategori Dağılımı", caption: "Fiş, ekstre ve harcama payı", Icon: BarChart3 },
  { id: "spendingDna", label: "Spending DNA", caption: "Davranışsal riskler", Icon: Brain },
  { id: "whatIf", label: "What-if", caption: "Karar simülasyonu", Icon: Sparkles },
  { id: "emotionalDelay", label: "Emotional Delay", caption: "Bekletilecek kararlar", Icon: Clock3 },
  { id: "actions", label: "Aksiyon Merkezi", caption: "Onay ve takip", Icon: ListChecks },
  { id: "subscriptions", label: "Abonelik Avcısı", caption: "Sızıntı ve tekrarlar", Icon: Repeat2 },
  { id: "portfolio", label: "Portföy", caption: "Varlıklar ve nakit", Icon: Landmark },
  { id: "business", label: "KOBİ", caption: "Nakit akışı ve CFO", Icon: BriefcaseBusiness }
];

const sectionMeta: Record<MobileSection, { eyebrow: string; title: string; subtitle: string }> = {
  overview: {
    eyebrow: "Ana ekran",
    title: "Özet",
    subtitle: "Gelir, gider, sağlık skoru ve hızlı kayıtlar."
  },
  categories: {
    eyebrow: "Harcama analizi",
    title: "Kategori Dağılımı",
    subtitle: "Fiş ve ekstreyle beslenen kategori kırılımı."
  },
  spendingDna: {
    eyebrow: "Davranışsal finans",
    title: "Spending DNA",
    subtitle: "Harcama refleksleri ve kategori riskleri."
  },
  whatIf: {
    eyebrow: "Karar simülasyonu",
    title: "What-if",
    subtitle: "Güvenli, dengeli ve riskli senaryolar."
  },
  emotionalDelay: {
    eyebrow: "Karar freni",
    title: "Emotional Delay",
    subtitle: "Ani harcamaları bekletme önerileri."
  },
  actions: {
    eyebrow: "Takip",
    title: "Aksiyon Merkezi",
    subtitle: "Onay bekleyen finansal aksiyonlar."
  },
  subscriptions: {
    eyebrow: "Sızıntı kontrolü",
    title: "Abonelik Avcısı",
    subtitle: "Tekrarlayan ve kullanılmayan ödemeler."
  },
  portfolio: {
    eyebrow: "Piyasa",
    title: "Portföy",
    subtitle: "Varlıklar, nakit ve mevduat takibi."
  },
  business: {
    eyebrow: "İşletme",
    title: "KOBİ",
    subtitle: "Tahsilat, ödeme ve nakit projeksiyonu."
  },
  agent: {
    eyebrow: "Finans asistanı",
    title: "Agent",
    subtitle: "Sağ alttaki ikizle sohbet."
  }
};

const dashboardPeriods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "daily", label: "Günlük" },
  { value: "weekly", label: "Haftalık" },
  { value: "monthly", label: "Aylık" },
  { value: "yearly", label: "Yıllık" }
];
const periodNetCaptions: Record<DashboardPeriod, string> = {
  daily: "günlük net durum",
  weekly: "haftalık net durum",
  monthly: "aylık net durum",
  yearly: "yıllık net durum"
};
const fallbackTransactionCategories: Category[] = [
  { id: "cat-salary", name: "Maaş", kind: "income", color: "#16a34a" },
  { id: "cat-market", name: "Market", kind: "expense", color: "#f59e0b" },
  { id: "cat-food", name: "Yemek", kind: "expense", color: "#ef4444" },
  { id: "cat-transport", name: "Ulaşım", kind: "expense", color: "#0891b2" },
  { id: "cat-tech", name: "Teknoloji", kind: "expense", color: "#4f46e5" },
  { id: "cat-clothes", name: "Giyim", kind: "expense", color: "#db2777" },
  { id: "cat-subscription", name: "Abonelik", kind: "expense", color: "#7c3aed" },
  { id: "cat-rent", name: "Kira", kind: "expense", color: "#64748b" },
  { id: "cat-other", name: "Diğer", kind: "expense", color: "#71717a" }
];

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => hasAuthToken());
  const [section, setSection] = useState<MobileSection>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [home, setHome] = useState<HomeData | null>(null);
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [period, setPeriod] = useState<DashboardPeriod>("monthly");

  useEffect(() => {
    if (!authenticated) return;
    setLoadError(null);
    void loadMobileHome({ period })
      .then((data) => {
        setHome(data);
        setBusiness(data.businessOverview);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Veri yüklenemedi."));
  }, [authenticated, period, refreshTick]);

  async function logout() {
    await clearAuthToken();
    setAuthenticated(false);
    setHome(null);
    setBusiness(null);
    setSection("overview");
  }

  function refreshData() {
    setRefreshTick((value) => value + 1);
  }

  if (!authenticated) {
    return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  const content =
    section === "portfolio" ? (
      <PortfolioScreen onImported={refreshData} />
    ) : section === "agent" ? (
      <AgentScreen onActionChanged={refreshData} />
    ) : section === "business" ? (
      home === null && !loadError ? (
        <Loading />
      ) : business ? (
        <BusinessScreen {...business} onChanged={refreshData} />
      ) : loadError ? (
        <LoadError message={loadError} />
      ) : (
        <BusinessOnboardingScreen onCreated={refreshData} />
      )
    ) : home ? (
      <HomeScreen
        {...home}
        section={section}
        activePeriod={period}
        onPeriodChange={setPeriod}
        onOpenPortfolio={() => setSection("portfolio")}
        onOpenBusiness={() => setSection("business")}
        onLogout={logout}
        onRefresh={refreshData}
      />
    ) : loadError ? (
      <LoadError message={loadError} />
    ) : (
      <Loading />
    );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <MobileTopBar activeSection={section} onOpenMenu={() => setMenuOpen(true)} />
      <ScrollView key={section} contentContainerStyle={[styles.scroll, localStyles.workspaceScroll]} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
      <MobileMenuDrawer
        visible={menuOpen}
        activeSection={section}
        onClose={() => setMenuOpen(false)}
        onLogout={logout}
        onSelect={(nextSection) => {
          setSection(nextSection);
          setMenuOpen(false);
        }}
      />
      <DraggableAgentBubble active={section === "agent"} onOpen={() => setSection("agent")} />
    </SafeAreaView>
  );
}

function MobileTopBar({ activeSection, onOpenMenu }: { activeSection: MobileSection; onOpenMenu: () => void }) {
  const meta = sectionMeta[activeSection];

  return (
    <View style={localStyles.mobileTopBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Menüyü aç" onPress={onOpenMenu} style={localStyles.menuButton}>
        <Menu size={20} color={palette.ink} />
      </Pressable>
      <View style={localStyles.topBrandMark}>
        <Text style={localStyles.authMarkText}>FS</Text>
      </View>
      <View style={localStyles.topBarCopy}>
        <Text style={localStyles.topBarEyebrow}>{meta.eyebrow}</Text>
        <Text style={localStyles.topBarTitle} numberOfLines={1}>
          {meta.title}
        </Text>
      </View>
    </View>
  );
}

function MobileMenuDrawer({
  visible,
  activeSection,
  onSelect,
  onClose,
  onLogout
}: {
  visible: boolean;
  activeSection: MobileSection;
  onSelect: (section: Exclude<MobileSection, "agent">) => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={localStyles.menuOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <SafeAreaView style={localStyles.menuSheet}>
          <View style={localStyles.menuBrand}>
            <View style={localStyles.authMark}>
              <Text style={localStyles.authMarkText}>FS</Text>
            </View>
            <View style={localStyles.alertCopy}>
              <Text style={localStyles.cardTitle}>Fintwin</Text>
              <Text style={styles.bodyMuted}>AI Financial Twin</Text>
            </View>
            <IconButton onPress={onClose} tone="muted">
              <X size={18} color={palette.ink} />
            </IconButton>
          </View>

          <ScrollView contentContainerStyle={localStyles.menuList} showsVerticalScrollIndicator={false}>
            {mobileNavItems.map((item) => {
              const Icon = item.Icon;
              const active = activeSection === item.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={item.id}
                  onPress={() => onSelect(item.id)}
                  style={[localStyles.menuItem, active && localStyles.menuItemActive]}
                >
                  <View style={[localStyles.menuItemIcon, active && localStyles.menuItemIconActive]}>
                    <Icon size={18} color={active ? palette.primary : palette.muted} />
                  </View>
                  <View style={localStyles.alertCopy}>
                    <Text style={[localStyles.menuItemLabel, active && localStyles.menuItemLabelActive]}>{item.label}</Text>
                    <Text style={localStyles.menuItemCaption}>{item.caption}</Text>
                  </View>
                  <ChevronRight size={16} color={active ? palette.primary : palette.darkMuted} />
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable accessibilityRole="button" style={localStyles.menuLogout} onPress={onLogout}>
            <LogOut size={17} color={palette.ink} />
            <Text style={localStyles.menuLogoutText}>Çıkış yap</Text>
          </Pressable>
          <View style={localStyles.trustNote}>
            <ShieldAlert size={16} color={palette.teal} />
            <Text style={localStyles.trustNoteText}>Detay ekranları menüden açılır; Agent sağ alttaki ikiz ikonunda.</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [biometricPending, setBiometricPending] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attemptBiometricLogin = useCallback(async () => {
    let unlocked = false;
    setBiometricPending(true);
    setError(null);
    try {
      const label = await getBiometricAuthLabel();
      setBiometricLabel(label ?? null);
      const token = await loadStoredAuthToken();
      if (token) {
        unlocked = true;
        onAuthenticated();
        return;
      }
      if (label) {
        setError(`${label} ile giriş tamamlanamadı. Şifreyle devam edebilirsin.`);
      }
    } catch (biometricError) {
      setError(biometricError instanceof Error ? biometricError.message : "Biyometrik giriş tamamlanamadı.");
    } finally {
      if (!unlocked) {
        setBiometricChecked(true);
        setBiometricPending(false);
      }
    }
  }, [onAuthenticated]);

  useEffect(() => {
    if (mode !== "login" || biometricChecked) return;
    void attemptBiometricLogin();
  }, [attemptBiometricLogin, biometricChecked, mode]);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result =
        mode === "register"
          ? await register({ name: name.trim(), email: email.trim(), password })
          : await login({ email: email.trim(), password });
      await persistAuthToken(result.token);
      onAuthenticated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Oturum açılamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <ScrollView contentContainerStyle={localStyles.authScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Panel style={localStyles.authPanel}>
          <View style={localStyles.authBrand}>
            <View style={localStyles.authMark}>
              <Text style={localStyles.authMarkText}>FS</Text>
            </View>
            <Text style={localStyles.overline}>Fintwin</Text>
            <Text style={localStyles.heroTitle}>Finansal ikizine giriş yap.</Text>
            <Text style={styles.subtitle}>Kişisel dashboard yalnızca oturum kullanıcısının kayıtlarını okur.</Text>
          </View>

          <View style={localStyles.authSwitch}>
            <Pressable
              style={[localStyles.authSwitchButton, mode === "login" && localStyles.authSwitchActive]}
              onPress={() => {
                setMode("login");
                setError(null);
              }}
            >
              <Text style={[localStyles.authSwitchText, mode === "login" && localStyles.authSwitchTextActive]}>Giriş</Text>
            </Pressable>
            <Pressable
              style={[localStyles.authSwitchButton, mode === "register" && localStyles.authSwitchActive]}
              onPress={() => {
                setMode("register");
                setError(null);
              }}
            >
              <Text style={[localStyles.authSwitchText, mode === "register" && localStyles.authSwitchTextActive]}>Kayıt</Text>
            </Pressable>
          </View>

          {mode === "login" ? (
            <View style={localStyles.biometricCard}>
              <View style={localStyles.biometricIcon}>
                {biometricPending ? <ActivityIndicator color={palette.primary} size="small" /> : <Fingerprint size={20} color={palette.primary} />}
              </View>
              <View style={localStyles.biometricCopy}>
                <Text style={localStyles.biometricTitle}>
                  {biometricPending
                    ? `${biometricLabel ?? "Face ID"} ile giriş deneniyor`
                    : biometricLabel
                      ? `${biometricLabel} ile hızlı giriş`
                      : "Şifreyle giriş"}
                </Text>
                <Text style={localStyles.biometricCaption}>
                  {biometricPending
                    ? "Kayıtlı oturum varsa önce biyometrik doğrulama açılır."
                    : biometricLabel
                      ? "Olmazsa aşağıdaki şifreyle devam edebilirsin."
                      : "Bu cihazda yüz tanıma hazır değilse şifreyle devam edebilirsin."}
                </Text>
              </View>
              {!biometricPending && biometricLabel ? (
                <Pressable accessibilityRole="button" style={localStyles.biometricRetry} onPress={attemptBiometricLogin}>
                  <Text style={localStyles.biometricRetryText}>Dene</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {mode === "register" ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ad Soyad"
              placeholderTextColor={palette.muted}
              autoCapitalize="words"
              style={localStyles.authInput}
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-posta"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={localStyles.authInput}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Şifre"
            placeholderTextColor={palette.muted}
            secureTextEntry
            style={localStyles.authInput}
          />

          {error ? <Text style={localStyles.authError}>{error}</Text> : null}
          <Button label={pending ? "Bekle..." : mode === "login" ? "Giriş yap" : "Hesap oluştur"} onPress={submit} disabled={pending} />
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

function DraggableAgentBubble({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Agent'i aç" onPress={onOpen} style={({ pressed }) => [localStyles.agentBubble, pressed && styles.pressed]}>
      <View style={[localStyles.agentBubbleInner, active && localStyles.agentBubbleInnerActive]}>
        <Image source={agentPet} resizeMode="contain" style={localStyles.agentBubblePet} />
        <Text style={localStyles.agentBubbleLabel}>İkiz</Text>
      </View>
    </Pressable>
  );
}

function HomeScreen({
  user,
  dashboard,
  dna,
  campaign,
  leaks,
  simulation,
  investmentPortfolio,
  businessOverview,
  section,
  activePeriod,
  onPeriodChange,
  onOpenPortfolio,
  onOpenBusiness,
  onLogout,
  onRefresh
}: {
  user: AuthUserProfile;
  dashboard: DashboardSummary;
  dna: SpendingDna;
  campaign: HomeData["campaign"];
  leaks: SubscriptionLeak[];
  simulation: WhatIfResponse;
  investmentPortfolio: HomeData["investmentPortfolio"];
  businessOverview: HomeData["businessOverview"];
  section: HomeSection;
  activePeriod: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  onOpenPortfolio: () => void;
  onOpenBusiness: () => void;
  onLogout: () => void;
  onRefresh: () => void;
}) {
  const monthlyLeak = leaks.reduce((total, leak) => total + leak.monthlyImpact, 0);
  const hasFinancialData =
    dashboard.income > 0 ||
    dashboard.expenses > 0 ||
    dashboard.balance !== 0 ||
    dashboard.categoryBreakdown.length > 0 ||
    dashboard.goals.length > 0 ||
    campaign.score > 0 ||
    simulation.cards.length > 0;
  const primaryRiskCategory = dna.categories.find((category) => category.riskScore >= 65 || category.monthlySpend > 0);

  if (section === "categories") {
    return (
      <>
        <ScreenHeader
          eyebrow="Harcama analizi"
          title="Kategori Dağılımı"
          subtitle="Bu dönemki harcamaları kategori bazında, pay oranı ve toplam etkiyle birlikte incele."
          right={<BarChart3 size={28} color={palette.primary} />}
        />
        <PeriodSwitcher activePeriod={activePeriod} periodLabel={dashboard.periodLabel} onChange={onPeriodChange} />
        <CategoryDistributionPanel dashboard={dashboard} />
        <CategoryRiskList dna={dna} periodLabel={dashboard.periodLabel} />
        <Panel>
          <SectionTitle title="Kategori verisini besle" meta="fiş / ekstre" />
          <Text style={styles.bodyMuted}>Fiş okutunca tek gider kaydı; banka ekstresi yükleyince seçtiğin satırlar kategori dağılımına otomatik yansır.</Text>
        </Panel>
        <ScanScreen onImported={onRefresh} />
      </>
    );
  }

  if (section === "spendingDna") {
    return (
      <>
        <ScreenHeader
          eyebrow="Davranışsal finans"
          title="Spending DNA Riskleri"
          subtitle="Harcama reflekslerini, kategori risklerini ve veri sinyallerini tek ekranda oku."
          right={<Brain size={28} color={palette.primary} />}
        />
        <PeriodSwitcher activePeriod={activePeriod} periodLabel={dashboard.periodLabel} onChange={onPeriodChange} />
        <SpendingDnaCard dna={dna} periodLabel={dashboard.periodLabel} />
        <SpendingDnaPatternPanel dna={dna} />
        <CategoryRiskList dna={dna} periodLabel={dashboard.periodLabel} />
      </>
    );
  }

  if (section === "whatIf") {
    return (
      <>
        <ScreenHeader
          eyebrow="Karar simülasyonu"
          title="What-if senaryosu"
          subtitle="Güvenli, dengeli ve riskli harcama senaryolarını nakit akışıyla birlikte incele."
          right={<Sparkles size={28} color={palette.primary} />}
        />
        <WhatIfPreview simulation={simulation} />
      </>
    );
  }

  if (section === "emotionalDelay") {
    return (
      <>
        <ScreenHeader
          eyebrow="Karar freni"
          title="Emotional Delay"
          subtitle="Ani harcama kararlarını bekletme önerisi, gerekçesi ve aksiyonlarıyla takip et."
          right={<PauseCircle size={28} color={palette.primary} />}
        />
        <EmotionalDelayPanel simulation={simulation} actions={dashboard.upcomingActions} onChanged={onRefresh} />
      </>
    );
  }

  if (section === "actions") {
    return (
      <>
        <ScreenHeader
          eyebrow="Karar ve takip"
          title="Finansal Aksiyon Merkezi"
          subtitle="Sistem ve agent tarafından üretilen aksiyonları burada onayla, reddet veya takip et."
          right={<ListChecks size={28} color={palette.primary} />}
        />
        <ActionStats actions={dashboard.upcomingActions} />
        <ActionCenter actions={dashboard.upcomingActions} onChanged={onRefresh} />
      </>
    );
  }

  if (section === "subscriptions") {
    return (
      <>
        <ScreenHeader
          eyebrow="Sızıntı kontrolü"
          title="Akıllı Abonelik Avcısı"
          subtitle="Tekrarlayan, kullanılmayan veya fiyatı artmış abonelikleri ayrı ekranda incele."
          right={<Repeat2 size={28} color={palette.primary} />}
        />
        <SubscriptionHunter leaks={leaks} />
      </>
    );
  }

  return (
    <>
      <FinancialHero user={user} dashboard={dashboard} simulation={simulation} hasFinancialData={hasFinancialData} onLogout={onLogout} />
      <PeriodSwitcher activePeriod={activePeriod} periodLabel={dashboard.periodLabel} onChange={onPeriodChange} />

      <View style={styles.metricGrid}>
        <MetricCard
          icon={<WalletCards size={18} color={palette.primary} />}
          label="Gelir"
          value={money(dashboard.income)}
          caption={dashboard.periodLabel}
          tone="primary"
        />
        <MetricCard
          icon={<ReceiptText size={18} color={palette.warn} />}
          label="Gider"
          value={money(dashboard.expenses)}
          caption={dashboard.periodLabel}
          tone="warn"
        />
        <MetricCard
          icon={<Target size={18} color={palette.teal} />}
          label="Bakiye"
          value={money(dashboard.balance)}
          caption={periodNetCaptions[dashboard.period]}
          tone="teal"
        />
        <MetricCard
          icon={<ShieldAlert size={18} color={palette.danger} />}
          label="Güvenli limit"
          value={hasFinancialData ? money(campaign.safeLimit) : "Beklemede"}
          caption={hasFinancialData ? `kampanya skoru ${campaign.score}` : primaryRiskCategory?.categoryName ?? "veri bekleniyor"}
          tone="danger"
        />
      </View>

      <ModuleOverviewCards
        investmentPortfolio={investmentPortfolio}
        businessOverview={businessOverview}
        onOpenPortfolio={onOpenPortfolio}
        onOpenBusiness={onOpenBusiness}
      />
      <ManualTransactionPanel user={user} onChanged={onRefresh} />
    </>
  );
}

function PeriodSwitcher({
  activePeriod,
  periodLabel,
  onChange
}: {
  activePeriod: DashboardPeriod;
  periodLabel: string;
  onChange: (period: DashboardPeriod) => void;
}) {
  return (
    <Panel style={localStyles.periodPanel}>
      <View style={localStyles.periodHeader}>
        <SectionTitle title="Dönem" meta={periodLabel} />
      </View>
      <View style={localStyles.periodControl}>
        {dashboardPeriods.map((option) => {
          const active = option.value === activePeriod;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[localStyles.periodButton, active && localStyles.periodButtonActive]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[localStyles.periodButtonText, active && localStyles.periodButtonTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

function FinancialHero({
  user,
  dashboard,
  simulation,
  hasFinancialData,
  onLogout
}: {
  user: AuthUserProfile;
  dashboard: DashboardSummary;
  simulation: WhatIfResponse;
  hasFinancialData: boolean;
  onLogout: () => void;
}) {
  const monthEnd = simulation.cards[0]?.monthEndBalance ?? dashboard.balance;

  return (
    <Panel style={localStyles.hero}>
      <View style={styles.rowBetween}>
        <View style={localStyles.heroCopy}>
          <Text style={localStyles.overline}>Kişisel · {dashboard.periodLabel}</Text>
          <Text style={[localStyles.heroTitle, localStyles.heroTitleLight]}>Merhaba, {user.name}</Text>
          <Text style={[localStyles.heroSubtitle, localStyles.heroSubtitleLight]}>
            {hasFinancialData
              ? "Finansal ikizin bu dönemki gelir, gider, risk ve aksiyon sinyallerini gerçek kayıtlarından izliyor."
              : "Gelir, gider, fiş veya ekstre eklediğinde finansal ikizin gerçek analiz üretmeye başlayacak."}
          </Text>
        </View>
        <View style={localStyles.heroActions}>
          <IconButton onPress={onLogout} tone="muted">
            <LogOut size={18} color={palette.ink} />
          </IconButton>
          <View style={localStyles.heroGauge}>
            <ScoreGauge score={dashboard.financialHealthScore} />
          </View>
        </View>
      </View>
      <View style={localStyles.balanceStrip}>
        <View>
          <Text style={localStyles.balanceLabel}>Bakiye</Text>
          <Mono style={localStyles.balanceValue}>{money(dashboard.balance)}</Mono>
        </View>
        <View style={localStyles.balanceDivider} />
        <View>
          <Text style={localStyles.balanceLabel}>Tahmini ay sonu</Text>
          <Mono style={localStyles.balanceValue}>{money(monthEnd)}</Mono>
        </View>
      </View>
    </Panel>
  );
}

function ModuleOverviewCards({
  investmentPortfolio,
  businessOverview,
  onOpenPortfolio,
  onOpenBusiness
}: {
  investmentPortfolio: HomeData["investmentPortfolio"];
  businessOverview: HomeData["businessOverview"];
  onOpenPortfolio: () => void;
  onOpenBusiness: () => void;
}) {
  const profitTone = investmentPortfolio.totalProfitLossTry >= 0 ? palette.success : palette.danger;

  return (
    <Panel>
      <SectionTitle title="Modüller" meta="kalıcı kayıtlar" />
      <Pressable accessibilityRole="button" style={localStyles.moduleCard} onPress={onOpenPortfolio}>
        <View style={localStyles.moduleIcon}>
          <Landmark size={20} color={palette.primary} />
        </View>
        <View style={localStyles.alertCopy}>
          <Text style={localStyles.cardTitle}>Yatırım Portföyü</Text>
          <Mono style={localStyles.moduleValue}>{money(investmentPortfolio.totalMarketValueTry)}</Mono>
          <Text style={styles.bodyMuted}>
            {investmentPortfolio.positions.length} varlık · <Text style={{ color: profitTone }}>%{Math.round(investmentPortfolio.totalProfitLossPercent)}</Text>
          </Text>
        </View>
        <ChevronRight size={18} color={palette.ink} />
      </Pressable>

      <Pressable accessibilityRole="button" style={localStyles.moduleCard} onPress={onOpenBusiness}>
        <View style={localStyles.moduleIcon}>
          <BriefcaseBusiness size={20} color={palette.primary} />
        </View>
        <View style={localStyles.alertCopy}>
          <Text style={localStyles.cardTitle}>{businessOverview?.business.name ?? "KOBİ profili oluştur"}</Text>
          <Mono style={localStyles.moduleValue}>{businessOverview ? money(businessOverview.dashboard.cashBalance) : "Kurulum"}</Mono>
          <Text style={styles.bodyMuted}>
            {businessOverview ? `${businessOverview.business.sector} · ${riskLabel(businessOverview.dashboard.liquidityRisk)}` : "İşletme, müşteri ve nakit akışı kaydı bekleniyor"}
          </Text>
        </View>
        <ChevronRight size={18} color={palette.ink} />
      </Pressable>
    </Panel>
  );
}

function RiskAlerts({ alerts, monthlyLeak, leaks }: { alerts: DashboardSummary["riskAlerts"]; monthlyLeak: number; leaks: SubscriptionLeak[] }) {
  const totalSignals = alerts.length + leaks.length;
  return (
    <Panel>
      <SectionTitle title="Risk Uyarıları" meta={totalSignals ? `${totalSignals} aktif sinyal` : "Risk yok"} />
      {alerts.map((alert) => (
        <AlertCard
          key={alert.title}
          icon={<AlertTriangle size={18} color={alert.level === "critical" || alert.level === "high" ? palette.danger : palette.warn} />}
          badge={riskLabel(alert.level)}
          title={alert.title}
          description={alert.description}
          action="İncele"
          tone={riskTone(alert.level)}
        />
      ))}
      {leaks.length ? (
        <AlertCard
          icon={<ShieldAlert size={18} color={palette.danger} />}
          badge="Abonelik sızıntısı"
          title={`Ayda ${money(monthlyLeak)} tasarruf potansiyeli`}
          description={`${leaks.length} bulgu gerçek abonelik kayıtlarından üretildi.`}
          action="Avcıyı aç"
          tone="danger"
        />
      ) : null}
      {!totalSignals ? <EmptyPanelMessage message="Şu an gösterilecek bütçe riski veya abonelik sızıntısı yok." /> : null}
    </Panel>
  );
}

function AlertCard({
  icon,
  badge,
  title,
  description,
  action,
  tone
}: {
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  action: string;
  tone: "warn" | "danger" | "primary";
}) {
  return (
    <View style={localStyles.alertCard}>
      <View style={styles.row}>
        <View style={localStyles.alertIcon}>{icon}</View>
        <View style={localStyles.alertCopy}>
          <Badge label={badge} tone={tone} />
          <Text style={localStyles.cardTitle}>{title}</Text>
          <Text style={styles.bodyMuted}>{description}</Text>
        </View>
        <View style={localStyles.chevronPill}>
          <ChevronRight size={18} color={palette.ink} />
        </View>
      </View>
      <Text style={[localStyles.actionLink, { color: tone === "danger" ? palette.danger : tone === "primary" ? palette.primary : palette.warn }]}>{action}</Text>
    </View>
  );
}

function SpendingDnaCard({ dna, periodLabel }: { dna: SpendingDna; periodLabel: string }) {
  const hasSignals = dna.categories.some((category) => category.monthlySpend > 0 || category.riskScore > 0);
  return (
    <Panel>
      <SectionTitle title="Spending DNA" meta={periodLabel} />
      {hasSignals ? (
        <>
          <View style={localStyles.dnaGrid}>
            <MiniSignal label="Genel risk" value={`${dna.overallRisk}/100`} tone="danger" />
            <MiniSignal label="Maaş sonrası refleks" value={`${dna.paydayReflexScore}/100`} tone="danger" />
            <MiniSignal label="Gece / hafta sonu" value={`${dna.weekendNightScore}/100`} tone="warn" />
            <MiniSignal label="Kampanya hassasiyeti" value={`${dna.campaignSensitivity}/100`} tone="primary" />
            <MiniSignal label="Tasarruf disiplini" value={`${dna.savingDiscipline}/100`} tone="teal" />
          </View>
          <View style={localStyles.patternCard}>
            <Text style={styles.body}>{dna.patterns[0]}</Text>
          </View>
        </>
      ) : (
        <EmptyPanelMessage message="Harcama verisi eklendiğinde Spending DNA davranış profili oluşacak." />
      )}
    </Panel>
  );
}

function MiniSignal({ label, value, tone }: { label: string; value: string; tone: "primary" | "teal" | "warn" | "danger" }) {
  return (
    <View style={localStyles.miniSignal}>
      <Text style={localStyles.miniLabel}>{label}</Text>
      <Mono style={[localStyles.miniValue, { color: toneColor(tone) }]}>{value}</Mono>
    </View>
  );
}

function CategoryRiskList({ dna, periodLabel }: { dna: SpendingDna; periodLabel: string }) {
  const riskItems = dna.categories.filter((item) => item.monthlySpend > 0 || item.riskScore > 0).slice(0, 4);
  return (
    <Panel>
      <SectionTitle title="Kategori Riskleri" meta={periodLabel} />
      {riskItems.length ? (
        riskItems.map((item) => (
          <RiskBar
            key={item.categoryId}
            label={item.categoryName}
            value={item.riskScore}
            amount={money(item.monthlySpend)}
          />
        ))
      ) : (
        <EmptyPanelMessage message="Kategori riski için önce fiş, işlem veya ekstre verisi eklenmeli." />
      )}
    </Panel>
  );
}

function CategoryDistributionPanel({ dashboard }: { dashboard: DashboardSummary }) {
  const total = dashboard.categoryBreakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <Panel>
      <SectionTitle title="Kategori Payları" meta={total ? money(total) : dashboard.periodLabel} />
      {dashboard.categoryBreakdown.length ? (
        dashboard.categoryBreakdown.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <View style={localStyles.categoryRow} key={item.categoryId}>
              <View style={styles.rowBetween}>
                <View style={styles.row}>
                  <View style={[localStyles.categorySwatch, { backgroundColor: item.color }]} />
                  <View>
                    <Text style={localStyles.cardTitle}>{item.name}</Text>
                    <Text style={styles.bodyMuted}>{money(item.value)}</Text>
                  </View>
                </View>
                <Mono style={localStyles.categoryPercent}>%{percent}</Mono>
              </View>
              <ProgressBar value={percent} tone={percent >= 40 ? "danger" : percent >= 25 ? "warn" : "teal"} />
            </View>
          );
        })
      ) : (
        <EmptyPanelMessage message="Kategori dağılımı için önce fiş, işlem veya ekstre verisi eklenmeli." />
      )}
    </Panel>
  );
}

function SpendingDnaPatternPanel({ dna }: { dna: SpendingDna }) {
  const confidence = Math.round((dna.dataConfidence ?? 0) * 100);
  return (
    <Panel>
      <SectionTitle title="Veri Güveni ve Bulgular" meta={dna.dataConfidenceLevel ?? "ölçülüyor"} />
      <View style={localStyles.dnaGrid}>
        <MiniSignal label="Veri güveni" value={dna.dataConfidence === undefined ? "Beklemede" : `%${confidence}`} tone="teal" />
        <MiniSignal label="Eksik veri" value={String(dna.missingData?.length ?? 0)} tone={dna.missingData?.length ? "warn" : "teal"} />
      </View>
      {dna.patterns.length ? (
        dna.patterns.map((pattern, index) => (
          <View style={localStyles.patternCard} key={`${pattern}-${index}`}>
            <Text style={styles.body}>{pattern}</Text>
          </View>
        ))
      ) : (
        <EmptyPanelMessage message="Davranış örüntüsü için daha fazla harcama verisi gerekiyor." />
      )}
      {dna.missingData?.length ? (
        <View style={localStyles.segmentedWrap}>
          {dna.missingData.map((item) => (
            <Badge key={item} label={item} tone="warn" />
          ))}
        </View>
      ) : null}
    </Panel>
  );
}

function EmotionalDelayPanel({ simulation, actions, onChanged }: { simulation: WhatIfResponse; actions: ActionItem[]; onChanged: () => void }) {
  const delayActions = actions.filter((action) => action.type === "delay_purchase");
  const delayMinutes = simulation.emotionalDelayMinutes;

  return (
    <>
      <Panel>
        <SectionTitle title="Bekletme Kararı" meta={delayMinutes ? `${delayMinutes} dakika` : "öneri yok"} />
        <View style={localStyles.delayCard}>
          <View style={styles.row}>
            <PauseCircle size={22} color={palette.primary} />
            <View style={localStyles.alertCopy}>
              <Text style={localStyles.cardTitle}>{delayMinutes ? "Ani harcamayı beklet" : "Bekleme önerisi üretilmedi"}</Text>
              <Text style={styles.bodyMuted}>
                {delayMinutes
                  ? "Bu senaryo nakit akışı ve risk sinyalleri nedeniyle kısa bir bekleme öneriyor."
                  : "Mevcut veride ekstra karar freni gerektiren bir sinyal yok."}
              </Text>
            </View>
            <Mono style={localStyles.timer}>{delayMinutes ? `${delayMinutes}:00` : "0:00"}</Mono>
          </View>
        </View>
        {simulation.assumptions.length ? (
          <View style={styles.wrapRow}>
            {simulation.assumptions.map((assumption) => (
              <Badge key={assumption} label={assumption} tone="muted" />
            ))}
          </View>
        ) : null}
      </Panel>
      <ActionCenter actions={delayActions} onChanged={onChanged} />
    </>
  );
}

function ActionStats({ actions }: { actions: ActionItem[] }) {
  const pending = actions.filter((action) => action.status === "pending").length;
  const approved = actions.filter((action) => action.status === "approved").length;
  const dismissed = actions.filter((action) => action.status === "dismissed").length;

  return (
    <View style={styles.metricGrid}>
      <MetricCard icon={<Clock3 size={18} color={palette.primary} />} label="Bekleyen" value={String(pending)} caption="karar bekliyor" tone="primary" />
      <MetricCard icon={<Check size={18} color={palette.success} />} label="Onaylanan" value={String(approved)} caption="takibe alındı" tone="success" />
      <MetricCard icon={<X size={18} color={palette.danger} />} label="Reddedilen" value={String(dismissed)} caption="kapatıldı" tone="danger" />
    </View>
  );
}

function GoalsSection({ goals }: { goals: Goal[] }) {
  return (
    <Panel>
      <SectionTitle title="Hedefler" meta="Hedef ekle" />
      {goals.length ? (
        goals.map((goal) => {
          const percent = Math.round((goal.currentAmount / goal.targetAmount) * 100);
          return (
            <View style={localStyles.goalCard} key={goal.id}>
              <View style={styles.rowBetween}>
                <Text style={localStyles.cardTitle}>{goal.title}</Text>
                <Badge label={`%${percent}`} tone="teal" />
              </View>
              <Text style={styles.bodyMuted}>
                {money(goal.currentAmount)} / {money(goal.targetAmount)}
              </Text>
              <ProgressBar value={percent} tone="teal" />
            </View>
          );
        })
      ) : (
        <EmptyPanelMessage message="Aktif finansal hedef yok." />
      )}
    </Panel>
  );
}

function ActionCenter({ actions, onChanged }: { actions: ActionItem[]; onChanged: () => void }) {
  return (
    <Panel>
      <SectionTitle title="Aksiyon Merkezi" meta={`Onay bekleyen ${actions.length} öneri`} />
      {actions.length ? actions.map((action) => <ActionCard key={action.id} action={action} onChanged={onChanged} />) : <EmptyPanelMessage message="Onay bekleyen finansal aksiyon yok." />}
    </Panel>
  );
}

function ActionCard({ action, onChanged }: { action: ActionItem; onChanged: () => void }) {
  const isDelay = action.type === "delay_purchase";
  const [pending, setPending] = useState<"approve" | "dismiss" | null>(null);
  const [status, setStatus] = useState(action.status);

  async function update(next: "approve" | "dismiss") {
    setPending(next);
    try {
      const updated = next === "approve" ? await approveAction(action.id) : await dismissAction(action.id);
      setStatus(updated.status);
      onChanged();
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={localStyles.actionCard}>
      <View style={styles.rowBetween}>
        <Badge label={status === "approved" ? "Onaylandı" : status === "dismissed" ? "Reddedildi" : isDelay ? "Emotional Delay" : "Hatırlatıcı"} tone={status === "approved" ? "success" : status === "dismissed" ? "danger" : isDelay ? "primary" : "teal"} />
        <Text style={localStyles.actionMeta}>{action.dueAt ? formatShortDate(action.dueAt) : "aktivasyon bekliyor"}</Text>
      </View>
      <Text style={localStyles.cardTitle}>{action.title}</Text>
      <Text style={styles.bodyMuted}>{action.description}</Text>
      {status === "pending" ? (
        <View style={localStyles.actionButtons}>
          <Button label={pending === "approve" ? "Onaylanıyor" : "Onayla"} icon={<Check size={15} color={palette.surface} />} style={localStyles.actionButton} disabled={Boolean(pending)} onPress={() => void update("approve")} />
          <Button label={pending === "dismiss" ? "Reddediliyor" : "Reddet"} variant="danger" icon={<X size={15} color={palette.danger} />} style={localStyles.actionButton} disabled={Boolean(pending)} onPress={() => void update("dismiss")} />
        </View>
      ) : null}
    </View>
  );
}

function ManualTransactionPanel({ user, onChanged }: { user: AuthUserProfile; onChanged: () => void }) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState("cat-other");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurring, setRecurring] = useState(false);
  const [categories, setCategories] = useState<Category[]>(fallbackTransactionCategories);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [salaryAmount, setSalaryAmount] = useState(user.monthlyIncome > 0 ? String(user.monthlyIncome) : "");
  const [payday, setPayday] = useState(String(user.payday));
  const [salaryPending, setSalaryPending] = useState(false);
  const [salaryStatus, setSalaryStatus] = useState<string | null>(null);
  const categoryOptions = useMemo(() => categories.filter((category) => category.kind === type), [categories, type]);

  useEffect(() => {
    void loadCategories()
      .then((items) => setCategories(items.length ? items : fallbackTransactionCategories))
      .catch(() => setCategories(fallbackTransactionCategories));
  }, []);

  useEffect(() => {
    if (!categoryOptions.some((option) => option.id === categoryId)) {
      setCategoryId(categoryOptions[0]?.id ?? "");
    }
  }, [categoryId, categoryOptions]);

  async function saveSalary() {
    const parsedSalary = parseDecimalInput(salaryAmount);
    const parsedPayday = Number(payday);
    if (parsedSalary === undefined || parsedSalary < 0 || !Number.isInteger(parsedPayday) || parsedPayday < 1 || parsedPayday > 31) {
      setSalaryStatus("Maaş sıfır veya pozitif, gün 1-31 arasında olmalı.");
      return;
    }
    setSalaryPending(true);
    setSalaryStatus(null);
    try {
      await updateFinanceProfile({
        monthlyIncome: parsedSalary,
        payday: parsedPayday,
        currency
      });
      setSalaryStatus("Maaş planı kaydedildi.");
      onChanged();
    } catch (error) {
      setSalaryStatus(error instanceof Error ? error.message : "Maaş planı kaydedilemedi.");
    } finally {
      setSalaryPending(false);
    }
  }

  async function addManual() {
    const parsedAmount = parseDecimalInput(amount);
    const customCategory = newCategoryName.trim();
    if (!merchant.trim() || parsedAmount === undefined || parsedAmount <= 0 || (!categoryId && !customCategory)) {
      setStatus("Açıklama, kategori ve geçerli pozitif tutar gerekli.");
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await createTransaction({
        merchant: merchant.trim(),
        amount: parsedAmount,
        type,
        categoryId: customCategory ? undefined : categoryId,
        categoryName: customCategory || undefined,
        currency,
        occurredAt: `${occurredAt}T12:00:00.000Z`,
        paymentMethod: type === "income" ? "transfer" : "debit_card",
        recurring
      });
      setMerchant("");
      setAmount("");
      setNewCategoryName("");
      setRecurring(false);
      setStatus("İşlem eklendi.");
      if (customCategory) {
        void loadCategories().then((items) => setCategories(items.length ? items : fallbackTransactionCategories));
      }
      onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "İşlem eklenemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel>
      <SectionTitle title="Gelir ve Gider Akışı" meta="maaş/manuel" />
      <View style={localStyles.salaryBox}>
        <Text style={localStyles.cardTitle}>Aylık maaş</Text>
        <View style={localStyles.formGrid}>
          <TextInput value={salaryAmount} onChangeText={setSalaryAmount} placeholder="Maaş tutarı" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
          <TextInput value={payday} onChangeText={setPayday} placeholder="Her ay günü" placeholderTextColor={palette.muted} keyboardType="number-pad" style={[localStyles.authInput, localStyles.formInput]} />
        </View>
        <Button label={salaryPending ? "Kaydediliyor" : "Maaşı kaydet"} onPress={() => void saveSalary()} disabled={salaryPending} icon={<CalendarPlus size={15} color={palette.surface} />} />
        {salaryStatus ? <Text style={salaryStatus.includes("kaydedildi") ? localStyles.formSuccess : localStyles.authError}>{salaryStatus}</Text> : null}
      </View>
      <View style={localStyles.formGrid}>
        <TextInput value={merchant} onChangeText={setMerchant} placeholder="Satıcı veya açıklama" placeholderTextColor={palette.muted} style={[localStyles.authInput, localStyles.formInput]} />
        <TextInput value={amount} onChangeText={setAmount} placeholder="Tutar" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
      </View>
      <View style={localStyles.segmentedInline}>
        {(["expense", "income"] as const).map((item) => (
          <Pressable key={item} onPress={() => setType(item)} style={[localStyles.segmentButton, type === item && localStyles.segmentButtonActive]}>
            <Text style={[localStyles.segmentButtonText, type === item && localStyles.segmentButtonTextActive]}>{item === "expense" ? "Gider" : "Gelir"}</Text>
          </Pressable>
        ))}
      </View>
      <View style={localStyles.formGrid}>
        <TextInput value={occurredAt} onChangeText={setOccurredAt} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={[localStyles.authInput, localStyles.formInput]} />
        <View style={[localStyles.segmentedInline, localStyles.formInput]}>
          {(["TRY", "USD", "EUR"] as const).map((item) => (
            <Pressable key={item} onPress={() => setCurrency(item)} style={[localStyles.segmentButton, currency === item && localStyles.segmentButtonActive]}>
              <Text style={[localStyles.segmentButtonText, currency === item && localStyles.segmentButtonTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={localStyles.segmentedWrap}>
        {categoryOptions.map((item) => (
          <Pressable key={item.id} onPress={() => setCategoryId(item.id)} style={[localStyles.segmentButton, localStyles.segmentWrapButton, categoryId === item.id && !newCategoryName.trim() && localStyles.segmentButtonActive]}>
            <Text style={[localStyles.segmentButtonText, categoryId === item.id && !newCategoryName.trim() && localStyles.segmentButtonTextActive]}>{item.name}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={newCategoryName} onChangeText={setNewCategoryName} placeholder="Yeni kategori yaz (isteğe bağlı)" placeholderTextColor={palette.muted} style={localStyles.authInput} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: recurring }} onPress={() => setRecurring((current) => !current)} style={[localStyles.recurringToggle, recurring && localStyles.recurringToggleActive]}>
        <Text style={[localStyles.segmentButtonText, recurring && localStyles.segmentButtonTextActive]}>Tekrar eden işlem</Text>
      </Pressable>
      <Button label={pending ? "Ekleniyor" : "İşlem ekle"} onPress={() => void addManual()} disabled={pending} icon={<Plus size={15} color={palette.surface} />} />
      {status ? <Text style={status.includes("gerekli") || status.includes("zorunlu") || status.includes("olmalı") || status.includes("edilemedi") ? localStyles.authError : localStyles.formSuccess}>{status}</Text> : null}
    </Panel>
  );
}

function WhatIfPreview({ simulation }: { simulation: WhatIfResponse }) {
  const delayMinutes = simulation.emotionalDelayMinutes;
  return (
    <Panel>
      <SectionTitle title="What-If Senaryosu" meta={delayMinutes ? "Emotional Delay" : "Veri durumu"} />
      <Text style={localStyles.quote}>“{simulation.question}”</Text>
      {simulation.cards.length ? (
        <>
          <View style={styles.wrapRow}>
            {simulation.cards.map((card) => (
              <Badge key={card.id} label={money(card.spendAmount)} tone={card.id === "safe" ? "teal" : card.id === "risky" ? "danger" : "primary"} />
            ))}
          </View>
          {simulation.cards.map((card) => (
            <ScenarioCardView key={card.id} card={card} />
          ))}
          <View style={localStyles.delayCard}>
            <View style={styles.row}>
              <PauseCircle size={20} color={palette.primary} />
              <View style={localStyles.alertCopy}>
                <Text style={localStyles.cardTitle}>{delayMinutes ? `${delayMinutes} dakika beklet` : "Bekleme önerisi yok"}</Text>
                <Text style={styles.bodyMuted}>
                  {delayMinutes ? "İkizin sakin bir karar için bekleme önerir." : "Bu senaryoda ek Emotional Delay gerekmiyor."}
                </Text>
              </View>
              <Mono style={localStyles.timer}>{delayMinutes ? `${delayMinutes}:00` : "0:00"}</Mono>
            </View>
          </View>
        </>
      ) : (
        <EmptyPanelMessage message="Gelir, gider veya bütçe verisi eklenince what-if senaryoları gerçek limitlerle hesaplanır." />
      )}
    </Panel>
  );
}

function ScenarioCardView({ card }: { card: ScenarioCard }) {
  const tone = card.id === "safe" ? "teal" : card.id === "balanced" ? "primary" : "danger";

  return (
    <View style={[localStyles.scenarioCard, card.id === "risky" && localStyles.scenarioSelected]}>
      <View style={styles.rowBetween}>
        <Badge label={card.id === "risky" ? "Riskli · seçili senaryo" : card.label} tone={tone} />
        <Mono style={[localStyles.scenarioAmount, { color: toneColor(tone) }]}>{money(card.spendAmount)}</Mono>
      </View>
      <Text style={styles.bodyMuted}>Ay sonu bakiye {money(card.monthEndBalance)}</Text>
      <Text style={styles.body}>{card.recommendation}</Text>
    </View>
  );
}

function SubscriptionHunter({ leaks }: { leaks: SubscriptionLeak[] }) {
  const total = leaks.reduce((sum, leak) => sum + leak.monthlyImpact, 0);

  return (
    <Panel>
      <ScreenHeader
        eyebrow="İkiz aracı"
        title="Abonelik Avcısı"
        subtitle={`${leaks.length} sızıntı tespit edildi · yıllık ${money(total * 12)}`}
        right={<Mono style={localStyles.leakTotal}>{money(total)}</Mono>}
      />
      <View style={styles.wrapRow}>
        <Badge label="Kullanılmıyor" tone="warn" />
        <Badge label="Fiyat artışı" tone="danger" />
        <Badge label="Mükerrer" tone="primary" />
      </View>
      {leaks.length ? (
        leaks.map((leak) => <SubscriptionLeakCard key={`${leak.subscriptionId}-${leak.issue}`} leak={leak} />)
      ) : (
        <EmptyPanelMessage message="Tekrar eden abonelik veya sızıntı bulgusu yok." />
      )}
    </Panel>
  );
}

function SubscriptionLeakCard({ leak }: { leak: SubscriptionLeak }) {
  const label = leakIssueLabel(leak.issue);
  const tone = leak.issue === "duplicate" ? "primary" : leak.issue === "price_increase" ? "danger" : "warn";

  return (
    <View style={localStyles.leakCard}>
      <View style={styles.rowBetween}>
        <View style={localStyles.alertCopy}>
          <Text style={localStyles.cardTitle}>{leak.merchant}</Text>
          <Badge label={label} tone={tone} />
        </View>
        <Mono style={localStyles.negativeValue}>− {money(leak.monthlyImpact)}</Mono>
      </View>
      <Text style={styles.bodyMuted}>{leak.recommendation}</Text>
    </View>
  );
}

function BusinessOnboardingScreen({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [cashBalance, setCashBalance] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !sector.trim()) {
      setStatus("İşletme adı ve sektör gerekli.");
      return;
    }
    const parsedCashBalance = parseDecimalInput(cashBalance);
    if (cashBalance.trim() && parsedCashBalance === undefined) {
      setStatus("Başlangıç kasa bakiyesi geçerli sayı olmalı.");
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await createBusiness({
        name: name.trim(),
        sector: sector.trim(),
        cashBalance: parsedCashBalance
      });
      setStatus("İşletme oluşturuldu.");
      onCreated();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "İşletme oluşturulamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ScreenHeader
        eyebrow="KOBİ kurulumu"
        title="İşletme profilini oluştur."
        subtitle="Nakit projeksiyonu ve tahsilat skorları gerçek işletme kayıtlarından çalışır."
        right={<Building2 size={28} color={palette.primary} />}
      />
      <Panel>
        <SectionTitle title="Başlangıç bilgileri" meta="yeni kayıt" />
        <TextInput value={name} onChangeText={setName} placeholder="İşletme adı" placeholderTextColor={palette.muted} style={localStyles.authInput} />
        <TextInput value={sector} onChangeText={setSector} placeholder="Sektör" placeholderTextColor={palette.muted} style={localStyles.authInput} />
        <TextInput value={cashBalance} onChangeText={setCashBalance} placeholder="Başlangıç kasa bakiyesi" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={localStyles.authInput} />
        <Button label={pending ? "Oluşturuluyor" : "İşletme oluştur"} onPress={() => void submit()} disabled={pending} icon={<Building2 size={15} color={palette.surface} />} />
        {status ? <Text style={status.includes("oluşturuldu") ? localStyles.formSuccess : localStyles.authError}>{status}</Text> : null}
      </Panel>
    </>
  );
}

function BusinessScreen({ business, dashboard, customers, scores, onChanged }: BusinessData & { onChanged: () => void }) {
  const net30Days = dashboard.projected30Days - dashboard.cashBalance;
  const projectionBars = projectionBarHeights(dashboard);
  return (
    <>
      <ScreenHeader
        eyebrow={`KOBİ · ${business.sector}`}
        title={business.name}
        subtitle="Nakit akışı, projeksiyon ve tahsilat skorları oturum kullanıcısının işletme kayıtlarından okunur."
        right={<Building2 size={28} color={palette.primary} />}
      />
      <Panel style={localStyles.cfoHero}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={localStyles.balanceLabel}>Kasa</Text>
            <Mono style={localStyles.cfoCash}>{money(dashboard.cashBalance)}</Mono>
            <Text style={localStyles.cfoDelta}>{signedMoney(net30Days)} · 30 gün net etki</Text>
          </View>
          <Badge label={`Likidite: ${riskLabel(dashboard.liquidityRisk)}`} tone={dashboard.liquidityRisk === "low" ? "teal" : "warn"} />
        </View>
        <View style={localStyles.sparkline}>
          {projectionBars.map((height, index) => (
            <View key={index} style={[localStyles.sparkBar, { height }]} />
          ))}
        </View>
        <View style={styles.rowBetween}>
          {["Bugün", "30g", "60g", "90g"].map((label) => (
            <Text style={localStyles.sparkLabel} key={label}>
              {label}
            </Text>
          ))}
        </View>
      </Panel>

      <Panel>
        <SectionTitle title="Nakit Projeksiyonu" meta="ikiz öngörüsü" />
        <View style={styles.metricGrid}>
          <MetricCard icon={<Clock3 size={18} color={palette.primary} />} label="30 gün" value={shortMoney(dashboard.projected30Days)} tone="primary" />
          <MetricCard icon={<Clock3 size={18} color={palette.teal} />} label="60 gün" value={shortMoney(dashboard.projected60Days)} tone="teal" />
          <MetricCard icon={<Clock3 size={18} color={palette.warn} />} label="90 gün" value={shortMoney(dashboard.projected90Days)} tone="warn" />
          <MetricCard icon={<Landmark size={18} color={palette.success} />} label="Risk" value={riskLabel(dashboard.liquidityRisk)} tone="success" />
        </View>
      </Panel>

      <CashEvents dashboard={dashboard} />
      <BusinessCashEventForm businessId={business.id} onChanged={onChanged} />
      <CollectionScores customers={customers} scores={scores} />
      <BusinessCustomerForm businessId={business.id} onChanged={onChanged} />
      <AiCfoSimulationPanel business={business} dashboard={dashboard} />
    </>
  );
}

function BusinessCashEventForm({ businessId, onChanged }: { businessId: string; onChanged: () => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"inflow" | "outflow">("inflow");
  const [dueAt, setDueAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    const parsedAmount = parseDecimalInput(amount);
    if (!title.trim() || parsedAmount === undefined || parsedAmount <= 0) {
      setStatus("Başlık ve geçerli pozitif tutar gerekli.");
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await createBusinessCashEvent(businessId, { title: title.trim(), amount: parsedAmount, type, dueAt });
      setTitle("");
      setAmount("");
      setStatus("Nakit olayı eklendi.");
      onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nakit olayı eklenemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel>
      <SectionTitle title="Nakit Olayı Ekle" meta={type === "inflow" ? "tahsilat" : "ödeme"} />
      <TextInput value={title} onChangeText={setTitle} placeholder="Başlık" placeholderTextColor={palette.muted} style={localStyles.authInput} />
      <View style={localStyles.formGrid}>
        <TextInput value={amount} onChangeText={setAmount} placeholder="Tutar" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
        <TextInput value={dueAt} onChangeText={setDueAt} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={[localStyles.authInput, localStyles.formInput]} />
      </View>
      <View style={localStyles.segmentedInline}>
        {(["inflow", "outflow"] as const).map((item) => (
          <Pressable key={item} onPress={() => setType(item)} style={[localStyles.segmentButton, type === item && localStyles.segmentButtonActive]}>
            <Text style={[localStyles.segmentButtonText, type === item && localStyles.segmentButtonTextActive]}>{item === "inflow" ? "Tahsilat" : "Ödeme"}</Text>
          </Pressable>
        ))}
      </View>
      <Button label={pending ? "Ekleniyor" : "Nakit olayı ekle"} onPress={() => void submit()} disabled={pending} icon={<CalendarPlus size={15} color={palette.surface} />} />
      {status ? <Text style={status.includes("eklendi") ? localStyles.formSuccess : localStyles.authError}>{status}</Text> : null}
    </Panel>
  );
}

function BusinessCustomerForm({ businessId, onChanged }: { businessId: string; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [averageDelayDays, setAverageDelayDays] = useState("");
  const [invoicesPaid, setInvoicesPaid] = useState("");
  const [invoicesLate, setInvoicesLate] = useState("");
  const [outstandingAmount, setOutstandingAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setStatus("Müşteri adı gerekli.");
      return;
    }
    const parsedAverageDelayDays = parseIntegerInput(averageDelayDays);
    const parsedInvoicesPaid = parseIntegerInput(invoicesPaid);
    const parsedInvoicesLate = parseIntegerInput(invoicesLate);
    const parsedOutstandingAmount = parseDecimalInput(outstandingAmount);
    if (
      (averageDelayDays.trim() && parsedAverageDelayDays === undefined) ||
      (invoicesPaid.trim() && parsedInvoicesPaid === undefined) ||
      (invoicesLate.trim() && parsedInvoicesLate === undefined) ||
      (outstandingAmount.trim() && parsedOutstandingAmount === undefined)
    ) {
      setStatus("Müşteri sayısal alanları sıfır veya pozitif geçerli sayı olmalı.");
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await createBusinessCustomer(businessId, {
        name: name.trim(),
        averageDelayDays: parsedAverageDelayDays,
        invoicesPaid: parsedInvoicesPaid,
        invoicesLate: parsedInvoicesLate,
        outstandingAmount: parsedOutstandingAmount
      });
      setName("");
      setAverageDelayDays("");
      setInvoicesPaid("");
      setInvoicesLate("");
      setOutstandingAmount("");
      setStatus("Müşteri eklendi.");
      onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Müşteri eklenemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel>
      <SectionTitle title="Müşteri Ekle" meta="tahsilat skoru" />
      <TextInput value={name} onChangeText={setName} placeholder="Müşteri adı" placeholderTextColor={palette.muted} style={localStyles.authInput} />
      <View style={localStyles.formGrid}>
        <TextInput value={averageDelayDays} onChangeText={setAverageDelayDays} placeholder="Ort. gecikme günü" placeholderTextColor={palette.muted} keyboardType="number-pad" style={[localStyles.authInput, localStyles.formInput]} />
        <TextInput value={outstandingAmount} onChangeText={setOutstandingAmount} placeholder="Açık bakiye" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
      </View>
      <View style={localStyles.formGrid}>
        <TextInput value={invoicesPaid} onChangeText={setInvoicesPaid} placeholder="Ödenen fatura" placeholderTextColor={palette.muted} keyboardType="number-pad" style={[localStyles.authInput, localStyles.formInput]} />
        <TextInput value={invoicesLate} onChangeText={setInvoicesLate} placeholder="Geciken fatura" placeholderTextColor={palette.muted} keyboardType="number-pad" style={[localStyles.authInput, localStyles.formInput]} />
      </View>
      <Button label={pending ? "Ekleniyor" : "Müşteri ekle"} onPress={() => void submit()} disabled={pending} icon={<UserPlus size={15} color={palette.surface} />} />
      {status ? <Text style={status.includes("eklendi") ? localStyles.formSuccess : localStyles.authError}>{status}</Text> : null}
    </Panel>
  );
}

function CashEvents({ dashboard }: { dashboard: BusinessDashboard }) {
  return (
    <Panel>
      <SectionTitle title="Yaklaşan ödemeler" meta="Tümü" />
      {dashboard.upcomingPayments.map((event) => (
        <View style={localStyles.cashRow} key={event.id}>
          <View style={localStyles.alertCopy}>
            <Text style={localStyles.cardTitle}>{event.title}</Text>
            <Text style={styles.bodyMuted}>{event.dueAt}</Text>
          </View>
          <Mono style={localStyles.negativeValue}>− {money(event.amount)}</Mono>
        </View>
      ))}
      <View style={styles.divider} />
      <SectionTitle title="Beklenen tahsilatlar" />
      {dashboard.expectedCollections.map((event) => (
        <View style={localStyles.cashRow} key={event.id}>
          <View style={localStyles.alertCopy}>
            <Text style={localStyles.cardTitle}>{event.title}</Text>
            <Text style={styles.bodyMuted}>{event.dueAt}</Text>
          </View>
          <Mono style={localStyles.positiveValue}>+ {money(event.amount)}</Mono>
        </View>
      ))}
    </Panel>
  );
}

function CollectionScores({ customers, scores }: { customers: BusinessCustomer[]; scores: CollectionScore[] }) {
  return (
    <Panel>
      <SectionTitle title="Tahsilat skorları" meta="müşteri ödeme davranışı" />
      {scores.map((score) => {
        const customer = customers.find((item) => item.id === score.customerId);
        const name = customer?.name ?? score.customerId;
        return (
          <View style={localStyles.collectionCard} key={score.customerId}>
            <View style={styles.rowBetween}>
              <View style={localStyles.alertCopy}>
                <Text style={localStyles.cardTitle}>{name}</Text>
                <Text style={styles.bodyMuted}>
                  {riskLabel(score.riskLevel)} · {customer?.averageDelayDays ?? 0} gün ortalama gecikme
                </Text>
              </View>
              <Mono style={[localStyles.collectionScore, { color: score.riskLevel === "critical" ? palette.danger : palette.warn }]}>
                {score.score}
              </Mono>
            </View>
            <ProgressBar value={score.score} tone={score.riskLevel === "critical" ? "danger" : "warn"} />
            <Text style={styles.bodyMuted}>{score.recommendation}</Text>
          </View>
        );
      })}
    </Panel>
  );
}

function AiCfoSimulationPanel({ business, dashboard }: { business: Business; dashboard: BusinessDashboard }) {
  const [amount, setAmount] = useState("75000");
  const [result, setResult] = useState<AiCfoSimulation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsedAmount = parseMoneyInput(amount);
  const previewAmount = parsedAmount ?? 0;

  async function runSimulation() {
    if (parsedAmount === undefined || parsedAmount <= 0) {
      setError("Simülasyon için pozitif bir tutar gir.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      setResult(await simulateBusinessDecision(business.id, { amount: parsedAmount, decision: "Mobil CFO simülasyonu" }));
    } catch (simulateError) {
      setError(simulateError instanceof Error ? simulateError.message : "Simülasyon çalıştırılamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel>
      <SectionTitle title="Kararı simüle et" meta="ikiz CFO önerisi" />
      <View style={localStyles.simInput}>
        <Text style={styles.bodyMuted}>Yeni yatırım tutarı:</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={localStyles.simAmountInput} />
      </View>
      <View style={styles.metricGrid}>
        <MiniFact label="30 gün sonrası" value={money(dashboard.projected30Days - previewAmount)} />
        <MiniFact label="Likidite" value={result ? riskLabel(result.riskLevel) : riskLabel(dashboard.liquidityRisk)} />
      </View>
      {result ? <Text style={styles.body}>İkiz CFO: {result.summary} {result.recommendedPlan}</Text> : null}
      {error ? <Text style={localStyles.authError}>{error}</Text> : null}
      <Button label={pending ? "Hesaplanıyor" : "Simülasyonu çalıştır"} icon={<FileScan size={15} color={palette.surface} />} onPress={() => void runSimulation()} disabled={pending} />
    </Panel>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={localStyles.miniFact}>
      <Text style={localStyles.miniLabel}>{label}</Text>
      <Mono style={localStyles.miniValue}>{value}</Mono>
    </View>
  );
}

function Loading() {
  return (
    <View style={localStyles.loading}>
      <ActivityIndicator color={palette.primary} />
      <Text style={styles.bodyMuted}>Veriler yükleniyor...</Text>
    </View>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <Panel>
      <SectionTitle title="API bağlantısı kurulamadı" meta="demo kapalı" />
      <Text style={styles.body}>{message}</Text>
      <Text style={styles.bodyMuted}>Backend'i çalıştır ve EXPO_PUBLIC_API_URL değerinin çalışan API adresini gösterdiğinden emin ol.</Text>
    </Panel>
  );
}

function money(value: number) {
  return `${Math.round(value).toLocaleString("tr-TR")} ₺`;
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : "−"} ${money(Math.abs(value))}`;
}

function parseMoneyInput(value: string) {
  return parseDecimalInput(value);
}

function parseDecimalInput(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseIntegerInput(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function projectionBarHeights(dashboard: BusinessDashboard) {
  const values = [dashboard.cashBalance, dashboard.projected30Days, dashboard.projected60Days, dashboard.projected90Days];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  return values.map((value) => 28 + Math.round(((value - min) / spread) * 52));
}

function formatShortDate(value: string) {
  const hasTime = value.includes("T");
  const date = new Date(hasTime ? value : `${value}T12:00:00`);
  return new Intl.DateTimeFormat("tr-TR", hasTime ? { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "long" }).format(date);
}

function EmptyPanelMessage({ message }: { message: string }) {
  return (
    <View style={localStyles.emptyMessage}>
      <Text style={styles.bodyMuted}>{message}</Text>
    </View>
  );
}

function shortMoney(value: number) {
  return `${Math.round(value / 1000).toLocaleString("tr-TR")} K ₺`;
}

function toneColor(tone: "primary" | "teal" | "warn" | "danger" | "success" | "muted") {
  return {
    primary: palette.primary,
    teal: palette.teal,
    warn: palette.warn,
    danger: palette.danger,
    success: palette.success,
    muted: palette.muted
  }[tone];
}

function riskLabel(level: string) {
  return {
    low: "düşük risk",
    medium: "orta risk",
    high: "yüksek risk",
    critical: "kritik"
  }[level] ?? level;
}

function riskTone(level: string): "warn" | "danger" | "primary" {
  if (level === "critical" || level === "high") return "danger";
  if (level === "medium") return "warn";
  return "primary";
}

function leakIssueLabel(issue: SubscriptionLeak["issue"]) {
  return {
    unused: "Kullanılmıyor",
    duplicate: "Mükerrer",
    small_leak: "Yeni",
    price_increase: "Fiyat artışı"
  }[issue];
}

const localStyles = StyleSheet.create({
  workspaceScroll: {
    paddingTop: 14,
    paddingBottom: 96
  },
  mobileTopBar: {
    marginHorizontal: 14,
    marginTop: 8,
    minHeight: 66,
    borderColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderRadius: 24,
    backgroundColor: "rgba(251,252,247,0.86)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    shadowColor: "#101815",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { height: 8, width: 0 },
    elevation: 8
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  topBrandMark: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: palette.secondary,
    alignItems: "center",
    justifyContent: "center"
  },
  topBarCopy: {
    flex: 1,
    gap: 2
  },
  topBarEyebrow: {
    color: palette.teal,
    fontFamily: typefaces.body,
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  topBarTitle: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700"
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(16,24,21,0.46)",
    justifyContent: "flex-start"
  },
  menuSheet: {
    width: "82%",
    maxWidth: 360,
    height: "100%",
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: palette.bg,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { height: 0, width: 12 },
    elevation: 24
  },
  menuBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 4
  },
  menuList: {
    gap: 8,
    paddingBottom: 8
  },
  menuItem: {
    minHeight: 68,
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.5)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10
  },
  menuItemActive: {
    borderColor: "rgba(37,87,214,0.2)",
    backgroundColor: "rgba(37,87,214,0.1)"
  },
  menuItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: palette.surface2,
    alignItems: "center",
    justifyContent: "center"
  },
  menuItemIconActive: {
    backgroundColor: palette.primarySoft
  },
  menuItemLabel: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700"
  },
  menuItemLabelActive: {
    color: palette.primary
  },
  menuItemCaption: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600"
  },
  menuLogout: {
    minHeight: 48,
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.52)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  menuLogoutText: {
    color: palette.ink,
    fontFamily: typefaces.body,
    fontSize: 13,
    fontWeight: "800"
  },
  trustNote: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.44)",
    flexDirection: "row",
    gap: 8,
    padding: 12
  },
  trustNoteText: {
    flex: 1,
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600"
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 18,
    backgroundColor: palette.bg
  },
  authPanel: {
    gap: 18,
    borderRadius: 30,
    padding: 22
  },
  authBrand: {
    gap: 8
  },
  authMark: {
    width: 54,
    height: 54,
    borderRadius: 19,
    backgroundColor: palette.secondary,
    alignItems: "center",
    justifyContent: "center"
  },
  authMarkText: {
    color: palette.surface,
    fontFamily: typefaces.display,
    fontSize: 16,
    fontWeight: "700"
  },
  authSwitch: {
    flexDirection: "row",
    gap: 5,
    backgroundColor: "rgba(16,24,21,0.06)",
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 999,
    padding: 5
  },
  authSwitchButton: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999
  },
  authSwitchActive: {
    backgroundColor: palette.secondary
  },
  authSwitchText: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 13,
    fontWeight: "700"
  },
  authSwitchTextActive: {
    color: palette.surface
  },
  authInput: {
    minHeight: 52,
    borderColor: "rgba(16,24,21,0.1)",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    color: palette.ink,
    backgroundColor: "rgba(255,255,255,0.62)",
    fontFamily: typefaces.body,
    fontSize: 14,
    fontWeight: "600"
  },
  biometricCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 22,
    backgroundColor: "rgba(37,87,214,0.07)",
    padding: 12
  },
  biometricIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primarySoft
  },
  biometricCopy: {
    flex: 1,
    gap: 3
  },
  biometricTitle: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 14,
    fontWeight: "700"
  },
  biometricCaption: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600"
  },
  biometricRetry: {
    minHeight: 36,
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    paddingHorizontal: 10
  },
  biometricRetryText: {
    color: palette.primary,
    fontFamily: typefaces.body,
    fontSize: 12,
    fontWeight: "800"
  },
  authError: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  formSuccess: {
    color: palette.success,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  salaryBox: {
    gap: 10,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.54)",
    padding: 12
  },
  agentTabPet: {
    width: 24,
    height: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  agentTabPetActive: {
    borderColor: "rgba(13,121,102,0.18)",
    backgroundColor: palette.surface
  },
  agentBubble: {
    position: "absolute",
    right: 16,
    bottom: 20,
    zIndex: 40,
    elevation: 18
  },
  agentBubbleInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: palette.primary,
    borderWidth: 3,
    borderColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { height: 12, width: 0 },
    elevation: 18
  },
  agentBubbleInnerActive: {
    backgroundColor: palette.secondary,
    borderColor: palette.primarySoft
  },
  agentBubblePet: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "transparent"
  },
  agentBubbleLabel: {
    opacity: 0,
    width: 1,
    height: 1
  },
  agentModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    justifyContent: "flex-end"
  },
  agentModalSheet: {
    maxHeight: "92%",
    backgroundColor: palette.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 14,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { height: -6, width: 0 },
    elevation: 20
  },
  agentModalHeader: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  agentModalContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 14
  },
  hero: {
    backgroundColor: palette.secondary,
    borderColor: palette.secondary,
    borderRadius: 30,
    padding: 22,
    overflow: "hidden"
  },
  heroCopy: {
    flex: 1,
    gap: 7
  },
  heroActions: {
    alignItems: "flex-end",
    gap: 10
  },
  heroGauge: {
    borderRadius: 999,
    backgroundColor: palette.surface,
    padding: 8
  },
  overline: {
    color: palette.teal,
    fontFamily: typefaces.body,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: 0
  },
  heroTitleLight: {
    color: palette.surface
  },
  heroSubtitle: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 13.5,
    lineHeight: 20
  },
  heroSubtitleLight: {
    color: "#C9D7D0"
  },
  balanceStrip: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  balanceLabel: {
    color: palette.darkMuted,
    fontFamily: typefaces.body,
    fontSize: 12,
    fontWeight: "600"
  },
  balanceValue: {
    color: palette.surface,
    fontFamily: typefaces.display,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    marginTop: 4
  },
  balanceDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.16)"
  },
  periodPanel: {
    gap: 12
  },
  periodHeader: {
    marginBottom: -4
  },
  periodControl: {
    flexDirection: "row",
    gap: 5,
    backgroundColor: "rgba(16,24,21,0.06)",
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 999,
    padding: 5
  },
  periodButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999
  },
  periodButtonActive: {
    backgroundColor: palette.secondary
  },
  periodButtonText: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 12.5,
    fontWeight: "700"
  },
  periodButtonTextActive: {
    color: palette.surface
  },
  moduleCard: {
    minHeight: 104,
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.52)"
  },
  moduleIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primarySoft
  },
  moduleValue: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700"
  },
  alertCard: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.5)"
  },
  alertIcon: {
    width: 34,
    height: 34,
    borderRadius: 16,
    backgroundColor: palette.surface2,
    alignItems: "center",
    justifyContent: "center"
  },
  alertCopy: {
    flex: 1,
    gap: 5
  },
  chevronPill: {
    width: 34,
    height: 34,
    borderRadius: 16,
    backgroundColor: palette.surface2,
    alignItems: "center",
    justifyContent: "center"
  },
  actionLink: {
    fontSize: 13,
    fontWeight: "800"
  },
  cardTitle: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: "700"
  },
  dnaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  miniSignal: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "rgba(16,24,21,0.08)",
    borderRadius: 20,
    padding: 12,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.52)"
  },
  miniFact: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "rgba(16,24,21,0.08)",
    borderRadius: 20,
    padding: 12,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.52)"
  },
  miniLabel: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 12,
    fontWeight: "600"
  },
  miniValue: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700"
  },
  patternCard: {
    borderLeftColor: palette.primary,
    borderLeftWidth: 4,
    backgroundColor: palette.primarySoft,
    borderRadius: 20,
    padding: 14
  },
  categoryRow: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.48)"
  },
  categorySwatch: {
    width: 12,
    height: 42,
    borderRadius: 999
  },
  categoryPercent: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 18,
    fontWeight: "700"
  },
  emptyMessage: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.46)"
  },
  goalCard: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.46)"
  },
  actionCard: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.52)"
  },
  actionMeta: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 12,
    fontWeight: "600"
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: "30%"
  },
  formGrid: {
    flexDirection: "row",
    gap: 10
  },
  formInput: {
    flex: 1
  },
  segmentedInline: {
    flexDirection: "row",
    gap: 5,
    backgroundColor: "rgba(16,24,21,0.06)",
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 999,
    padding: 5
  },
  segmentedWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    backgroundColor: "rgba(16,24,21,0.06)",
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 5
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999
  },
  segmentWrapButton: {
    flexGrow: 1,
    flexBasis: "30%"
  },
  segmentButtonActive: {
    backgroundColor: palette.secondary
  },
  segmentButtonText: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 12.5,
    fontWeight: "700"
  },
  segmentButtonTextActive: {
    color: palette.surface
  },
  recurringToggle: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: "rgba(16,24,21,0.04)",
    paddingHorizontal: 12
  },
  recurringToggleActive: {
    backgroundColor: palette.secondary,
    borderColor: palette.secondary
  },
  flexButton: {
    flexGrow: 1,
    flexBasis: "46%"
  },
  quote: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 21,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: 0
  },
  scenarioCard: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 9,
    backgroundColor: "rgba(255,255,255,0.46)"
  },
  scenarioSelected: {
    borderColor: palette.danger,
    backgroundColor: palette.dangerSoft
  },
  scenarioAmount: {
    fontFamily: typefaces.display,
    fontSize: 18,
    fontWeight: "700"
  },
  delayCard: {
    backgroundColor: palette.primarySoft,
    borderRadius: 20,
    padding: 14
  },
  timer: {
    color: palette.primary,
    fontFamily: typefaces.display,
    fontSize: 20,
    fontWeight: "700"
  },
  leakTotal: {
    color: palette.primary,
    fontFamily: typefaces.display,
    fontSize: 22,
    fontWeight: "700"
  },
  leakCard: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10
  },
  negativeValue: {
    color: palette.danger,
    fontFamily: typefaces.body,
    fontSize: 15,
    fontWeight: "800"
  },
  positiveValue: {
    color: palette.success,
    fontFamily: typefaces.body,
    fontSize: 15,
    fontWeight: "800"
  },
  agentInputShell: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  agentInput: {
    flex: 1,
    minHeight: 112,
    borderColor: "rgba(16,24,21,0.1)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    color: palette.ink,
    backgroundColor: "rgba(255,255,255,0.6)",
    fontFamily: typefaces.body,
    fontSize: 14,
    lineHeight: 20
  },
  emptyPanel: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220
  },
  agentLatency: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 12,
    fontWeight: "700"
  },
  agentAnswer: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600"
  },
  evidenceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  evidenceItem: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: "rgba(16,24,21,0.06)",
    borderRadius: 18,
    padding: 10,
    gap: 5
  },
  evidenceLabel: {
    color: palette.muted,
    fontFamily: typefaces.body,
    fontSize: 12,
    fontWeight: "600"
  },
  evidenceValue: {
    color: palette.ink,
    fontFamily: typefaces.body,
    fontSize: 13.5,
    fontWeight: "800"
  },
  suggestedAction: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 4
  },
  cfoHero: {
    backgroundColor: palette.secondary,
    borderColor: palette.secondary,
    borderRadius: 30,
    overflow: "hidden"
  },
  cfoCash: {
    color: palette.surface,
    fontFamily: typefaces.display,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700",
    marginTop: 4
  },
  cfoDelta: {
    color: "#A7F3D0",
    fontFamily: typefaces.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  sparkline: {
    height: 82,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8
  },
  sparkBar: {
    flex: 1,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: "#71E0BD"
  },
  sparkLabel: {
    color: palette.darkMuted,
    fontFamily: typefaces.body,
    fontSize: 11,
    fontWeight: "700"
  },
  cashRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    paddingTop: 12
  },
  collectionCard: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.46)"
  },
  collectionScore: {
    fontFamily: typefaces.display,
    fontSize: 32,
    fontWeight: "700"
  },
  simInput: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.52)"
  },
  simAmountInput: {
    color: palette.ink,
    fontFamily: typefaces.display,
    fontSize: 22,
    fontWeight: "700",
    paddingVertical: 0
  },
  loading: {
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  }
});
