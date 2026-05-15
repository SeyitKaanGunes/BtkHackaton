import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Brain,
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileScan,
  FileText,
  Fingerprint,
  History,
  Info,
  Landmark,
  ListChecks,
  LogOut,
  Menu,
  MessageSquareText,
  PauseCircle,
  PiggyBank,
  Plus,
  Repeat2,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  ReceiptText,
  Trash2,
  TrendingUp,
  UserPlus,
  WalletCards,
  X
} from "lucide-react-native";
import type {
  Account,
  ActionItem,
  AiCfoSimulation,
  Budget,
  BusinessCashflowPoint,
  BusinessCoverageAnalysis,
  BusinessDnaFactor,
  Business,
  BusinessCustomer,
  BusinessDashboard,
  BusinessInsights,
  BusinessScenarioAnalysis,
  BusinessSummaryInsight,
  Category,
  CollectionScore,
  CollectionPriority,
  Currency,
  DashboardPeriod,
  DashboardSummary,
  DecisionJournalSummary,
  DocumentDetail,
  DocumentHistoryItem,
  GoalAdviceResponse,
  Goal,
  PlanningOverview,
  ScenarioCard,
  SpendingDna,
  SimulationHistoryItem,
  Subscription,
  SubscriptionLeak,
  SubscriptionStatus,
  Transaction,
  TransactionType,
  UserDecisionAction,
  WhatIfResponse
} from "@fintwin/shared";
import { buildBusinessInsights, parseAmountFromText } from "@fintwin/shared";
import {
  approveAction,
  clearAuthToken,
  createAccount,
  createBudget,
  createBusiness,
  createBusinessCashEvent,
  createBusinessCustomer,
  createGoal,
  createSubscription,
  createTransaction,
  deleteAccount,
  deleteBudget,
  deleteGoal,
  dismissAction,
  getGoalAdvice,
  getBiometricAuthLabel,
  hasAuthToken,
  loadBusiness,
  loadCategories,
  loadDecisionSummary,
  loadDocumentDetail,
  loadMobileHome,
  loadSimulationHistory,
  loadStoredAuthToken,
  loadTransactions,
  login,
  loginWithGoogle,
  postDecisionEvent,
  persistAuthToken,
  register,
  runWhatIf,
  simulateBusinessDecision,
  upsertBudget,
  upsertSavingsPlan,
  updateSubscription,
  updateFinanceProfile,
  type AuthUserProfile
} from "./src/api";
import { GoogleSignInCancelledError, getGoogleSignInConfigState, requestGoogleIdToken } from "./src/googleSignIn";
import { AgentScreen } from "./src/screens/AgentScreen";
import { PortfolioScreen } from "./src/screens/PortfolioScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { Badge, Button, Gauge as ScoreGauge, IconButton, MetricCard, Mono, Panel, ProgressBar, RiskBar, ScreenHeader, SectionTitle, palette, styles, typefaces } from "./src/ui";

type MobileSection = "overview" | "financialProfile" | "categories" | "spendingDna" | "whatIf" | "goals" | "emotionalDelay" | "actions" | "subscriptions" | "portfolio" | "business" | "agent";
type HomeSection = Exclude<MobileSection, "portfolio" | "business" | "agent">;
type NavIcon = typeof WalletCards;
type HomeData = Awaited<ReturnType<typeof loadMobileHome>>;
type BusinessData = NonNullable<Awaited<ReturnType<typeof loadBusiness>>>;
type BusinessMobileSection = "twin" | "dna" | "cashflow" | "coverage" | "collections" | "scenarios" | "records" | "assistant";

const agentPet = require("./src/assets/agent-pet.png");

const mobileNavItems: Array<{ id: Exclude<MobileSection, "agent">; label: string; caption: string; Icon: NavIcon }> = [
  { id: "overview", label: "Özet", caption: "Ana finansal durum", Icon: WalletCards },
  { id: "financialProfile", label: "Finansal Profil", caption: "Hesap, bütçe ve hedefler", Icon: SlidersHorizontal },
  { id: "categories", label: "Kategori Dağılımı", caption: "Fiş, ekstre ve harcama payı", Icon: BarChart3 },
  { id: "spendingDna", label: "Spending DNA", caption: "Davranışsal riskler", Icon: Brain },
  { id: "whatIf", label: "What-if", caption: "Karar simülasyonu", Icon: Sparkles },
  { id: "goals", label: "Hedefler", caption: "Birikim ve limit planı", Icon: Target },
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
  financialProfile: {
    eyebrow: "Finansal ikiz kurulumu",
    title: "Finansal Profil",
    subtitle: "Hesap, bütçe, hedef ve gelir bağlamı."
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
  goals: {
    eyebrow: "Hedef ve limit planı",
    title: "Hedefler",
    subtitle: "Birikim planı, kategori limitleri ve hedef koçu."
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
  { id: "cat-other-income", name: "Diğer gelir", kind: "income", color: "#0d9488" },
  { id: "cat-market", name: "Market", kind: "expense", color: "#f59e0b" },
  { id: "cat-food", name: "Yemek", kind: "expense", color: "#ef4444" },
  { id: "cat-transport", name: "Ulaşım", kind: "expense", color: "#0891b2" },
  { id: "cat-tech", name: "Teknoloji", kind: "expense", color: "#4f46e5" },
  { id: "cat-clothes", name: "Giyim", kind: "expense", color: "#db2777" },
  { id: "cat-subscription", name: "Abonelik", kind: "expense", color: "#7c3aed" },
  { id: "cat-rent", name: "Kira", kind: "expense", color: "#64748b" },
  { id: "cat-other", name: "Diğer", kind: "expense", color: "#71717a" }
];
const accountTypeOptions: Array<{ value: Account["type"]; label: string }> = [
  { value: "debit", label: "Vadesiz" },
  { value: "credit", label: "Kredi kartı" },
  { value: "savings", label: "Birikim" },
  { value: "cash", label: "Nakit" }
];
const businessSectionOptions: Array<{ value: BusinessMobileSection; label: string }> = [
  { value: "twin", label: "İkiz" },
  { value: "dna", label: "DNA" },
  { value: "cashflow", label: "Nakit" },
  { value: "coverage", label: "Maaş/Kira" },
  { value: "collections", label: "Tahsilat" },
  { value: "scenarios", label: "Senaryo" },
  { value: "assistant", label: "Asistan" },
  { value: "records", label: "Veri" }
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
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [pending, setPending] = useState(false);
  const [biometricPending, setBiometricPending] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googleNote, setGoogleNote] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);
  const googleConfig = useMemo(() => getGoogleSignInConfigState(), []);

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
    setGoogleNote(null);
    try {
      const result =
        mode === "register"
          ? await register({ name: name.trim(), email: email.trim(), password, accountType })
          : await login({ email: email.trim(), password, accountType });
      setGoogleReady(result.oauth?.googleReady ?? null);
      await persistAuthToken(result.token);
      onAuthenticated();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Oturum açılamadı.");
    } finally {
      setPending(false);
    }
  }

  async function startGoogleSignIn() {
    setPending(true);
    setError(null);
    setGoogleNote(null);
    try {
      const idToken = await requestGoogleIdToken();
      const result = await loginWithGoogle({ idToken, accountType });
      setGoogleReady(result.oauth?.googleReady ?? null);
      await persistAuthToken(result.token);
      onAuthenticated();
    } catch (googleError) {
      if (googleError instanceof GoogleSignInCancelledError) {
        setGoogleNote(googleError.message);
      } else {
        const message = googleError instanceof Error ? googleError.message : "Google ile oturum açılamadı.";
        if (message.includes("GOOGLE_OAUTH_CLIENT_ID") || message.includes("Google girişi için")) {
          setGoogleReady(false);
        }
        setError(message);
      }
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

          <View style={localStyles.accountTypeGroup} accessibilityRole="radiogroup" accessibilityLabel="Hesap türü">
            <Text style={localStyles.miniLabel}>Hesap türü</Text>
            <View style={localStyles.accountTypeGrid}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: accountType === "personal" }}
                onPress={() => setAccountType("personal")}
                style={[localStyles.accountTypeButton, accountType === "personal" && localStyles.accountTypeButtonActive]}
              >
                <Text style={[localStyles.cardTitle, accountType === "personal" && localStyles.accountTypeTextActive]}>Kişisel</Text>
                <Text style={[styles.bodyMuted, accountType === "personal" && localStyles.accountTypeCaptionActive]}>Bütçe, portföy ve harcama içgörüleri</Text>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: accountType === "business" }}
                onPress={() => setAccountType("business")}
                style={[localStyles.accountTypeButton, accountType === "business" && localStyles.accountTypeButtonActive]}
              >
                <Text style={[localStyles.cardTitle, accountType === "business" && localStyles.accountTypeTextActive]}>KOBİ</Text>
                <Text style={[styles.bodyMuted, accountType === "business" && localStyles.accountTypeCaptionActive]}>Nakit akışı, tahsilat ve işletme ekranı</Text>
              </Pressable>
            </View>
          </View>

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

          {googleConfig.ready ? (
            <>
              <View style={localStyles.authSeparator}>
                <View style={localStyles.authSeparatorLine} />
                <Text style={localStyles.miniLabel}>veya</Text>
                <View style={localStyles.authSeparatorLine} />
              </View>
              <Button label="Google ile oturum aç" variant="secondary" disabled={pending} onPress={startGoogleSignIn} />
            </>
          ) : null}
          {googleReady === false ? (
            <Text style={styles.bodyMuted}>{googleConfig.message ?? "Google girişi backend tarafında kapalı görünüyor; e-posta/şifre ile devam et."}</Text>
          ) : null}
          {googleNote ? <Text style={styles.bodyMuted}>{googleNote}</Text> : null}
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
  subscriptions,
  simulation,
  decisionSummary,
  decisionHistory,
  investmentPortfolio,
  businessOverview,
  financialProfile,
  planningOverview,
  documents,
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
  subscriptions: Subscription[];
  simulation: WhatIfResponse;
  decisionSummary: DecisionJournalSummary;
  decisionHistory: SimulationHistoryItem[];
  investmentPortfolio: HomeData["investmentPortfolio"];
  businessOverview: HomeData["businessOverview"];
  financialProfile: HomeData["financialProfile"];
  planningOverview: HomeData["planningOverview"];
  documents: DocumentHistoryItem[];
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

  if (section === "financialProfile") {
    return (
      <>
        <ScreenHeader
          eyebrow="Finansal ikiz kurulumu"
          title="Finansal Profil"
          subtitle="Web'deki profil verisini mobilde de gör; gelir güncellemesi ve hedef/bütçe bağlamı aynı API'den okunur."
          right={<SlidersHorizontal size={28} color={palette.primary} />}
        />
        <MobileFinancialProfile user={user} profile={financialProfile} categories={planningOverview.categories} onChanged={onRefresh} />
      </>
    );
  }

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
        <SpendingDnaCommentaryPanel dna={dna} />
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
        <WhatIfPreview simulation={simulation} summary={decisionSummary} history={decisionHistory} submitLabel="Senaryoyu hesapla" />
      </>
    );
  }

  if (section === "goals") {
    return (
      <>
        <ScreenHeader
          eyebrow="Hedef ve limit planı"
          title="Hedefler"
          subtitle="Web'deki birikim planı, kategori limitleri, hedef koçu ve aktif hedef yönetimi mobilde de aynı veriyle çalışır."
          right={<Target size={28} color={palette.primary} />}
        />
        <MobileGoalsPlanner initialPlanning={planningOverview} onChanged={onRefresh} />
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
        <EmotionalDelayPanel simulation={simulation} summary={decisionSummary} history={decisionHistory} actions={dashboard.upcomingActions} campaign={campaign} onChanged={onRefresh} />
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
        <SubscriptionHunter leaks={leaks} subscriptions={subscriptions} onChanged={onRefresh} />
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
          label="Harcama sınırı"
          value={hasFinancialData ? money(campaign.safeLimit) : "Beklemede"}
          caption={hasFinancialData ? "Üstünü tekrar düşün" : primaryRiskCategory?.categoryName ?? "veri bekleniyor"}
          tone="danger"
        />
      </View>

      <ModuleOverviewCards
        investmentPortfolio={investmentPortfolio}
        businessOverview={businessOverview}
        onOpenPortfolio={onOpenPortfolio}
        onOpenBusiness={onOpenBusiness}
      />
      <ScanScreen onImported={onRefresh} />
      <DocumentHistoryPanel documents={documents} />
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
  const metrics = dna.metrics;
  return (
    <Panel>
      <SectionTitle title="Spending DNA" meta={periodLabel} />
      {hasSignals ? (
        <>
          <View style={localStyles.dnaGrid}>
            <MiniSignalCaption label="Genel risk" value={`${dna.overallRisk}/100`} caption={metricCaption(metrics?.overallRisk.reasons, dna.reasons)} tone="danger" />
            <MiniSignalCaption label="Maaş sonrası refleks" value={`${dna.paydayReflexScore}/100`} caption={metricCaption(metrics?.paydayReflexScore.reasons)} tone="danger" />
            <MiniSignalCaption label="Gece / hafta sonu" value={`${dna.weekendNightScore}/100`} caption={metricCaption(metrics?.weekendNightScore.reasons)} tone="warn" />
            <MiniSignalCaption label="Kampanya hassasiyeti" value={`${dna.campaignSensitivity}/100`} caption={metricCaption(metrics?.campaignSensitivity.reasons)} tone="primary" />
            <MiniSignalCaption label="Tasarruf disiplini" value={`${dna.savingDiscipline}/100`} caption={metricCaption(metrics?.savingDiscipline.reasons)} tone="teal" />
          </View>
          {dna.patterns[0] ? (
            <View style={localStyles.patternCard}>
              <Text style={styles.body}>{dna.patterns[0]}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <EmptyPanelMessage message="Harcama verisi eklendiğinde Spending DNA davranış profili oluşacak." />
      )}
    </Panel>
  );
}

function MiniSignalCaption({ label, value, caption, tone }: { label: string; value: string; caption?: string; tone: "primary" | "teal" | "warn" | "danger" }) {
  return (
    <View style={localStyles.miniSignal}>
      <Text style={localStyles.miniLabel}>{label}</Text>
      <Mono style={[localStyles.miniValue, { color: toneColor(tone) }]}>{value}</Mono>
      {caption ? <Text style={styles.bodyMuted}>{caption}</Text> : null}
    </View>
  );
}

function metricCaption(primary?: string[], fallback?: string[]) {
  const reason = primary?.[0] ?? fallback?.[0];
  return reason ?? "Gerçek işlem geçmişinden hesaplandı.";
}

function SpendingDnaCommentaryPanel({ dna }: { dna: SpendingDna }) {
  const commentary = dna.commentary;
  return (
    <Panel>
      <SectionTitle title="Yorum" meta={commentary?.source === "llm" ? "LLM" : "Beklemede"} />
      {commentary ? (
        <View style={localStyles.commentaryCard}>
          <MessageSquareText size={20} color={palette.primary} />
          <View style={localStyles.alertCopy}>
            <Text style={styles.body}>{commentary.summary}</Text>
            {commentary.takeaways.length ? (
              <View style={localStyles.profileRowList}>
                {commentary.takeaways.map((item) => (
                  <View style={styles.row} key={item}>
                    <Sparkles size={14} color={palette.primary} />
                    <Text style={[styles.bodyMuted, localStyles.profileRowText]}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <EmptyPanelMessage message="Risk skorları geldikten sonra LLM yorumu burada gösterilir." />
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
          <View style={localStyles.categoryRiskCard} key={item.categoryId}>
            <RiskBar label={item.categoryName} value={item.riskScore} amount={money(item.monthlySpend)} />
            {item.budgetLimit ? (
              <Text style={styles.bodyMuted}>Aylık limit {money(item.budgetLimit)}</Text>
            ) : null}
            {item.reasons?.length ? (
              <View style={localStyles.profileRowList}>
                {item.reasons.map((reason) => (
                  <View style={styles.row} key={reason}>
                    <AlertTriangle size={13} color={palette.warn} />
                    <Text style={[styles.bodyMuted, localStyles.profileRowText]}>{reason}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))
      ) : (
        <EmptyPanelMessage message="Kategori riski için önce fiş, işlem veya ekstre verisi eklenmeli." />
      )}
    </Panel>
  );
}

function CategoryDistributionPanel({ dashboard }: { dashboard: DashboardSummary }) {
  const total = dashboard.categoryBreakdown.reduce((sum, item) => sum + item.value, 0);
  const sorted = useMemo(
    () => [...dashboard.categoryBreakdown].sort((left, right) => right.value - left.value),
    [dashboard.categoryBreakdown]
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!selectedCategoryId) return;
    if (transactions.length > 0 || transactionsLoading) return;
    setTransactionsLoading(true);
    setTransactionsError(null);
    void loadTransactions()
      .then((items) => {
        if (!cancelled) setTransactions(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setTransactionsError(error instanceof Error ? error.message : "İşlem listesi alınamadı.");
        }
      })
      .finally(() => {
        if (!cancelled) setTransactionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId, transactions.length, transactionsLoading]);

  const selectedCategory = sorted.find((item) => item.categoryId === selectedCategoryId) ?? null;
  const selectedTransactions = useMemo(() => {
    if (!selectedCategory) return [] as Transaction[];
    return transactions
      .filter((transaction) => {
        if (transaction.type !== "expense") return false;
        if (transaction.categoryId !== selectedCategory.categoryId) return false;
        const date = transactionDateKey(transaction.occurredAt);
        return date >= dashboard.periodStart && date <= dashboard.periodEnd;
      })
      .sort((left, right) => right.amount - left.amount || right.occurredAt.localeCompare(left.occurredAt));
  }, [dashboard.periodEnd, dashboard.periodStart, selectedCategory, transactions]);
  const highestTransaction = selectedTransactions[0];

  return (
    <Panel>
      <SectionTitle title="Kategori Payları" meta={total ? money(total) : dashboard.periodLabel} />
      {sorted.length ? (
        sorted.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const isActive = item.categoryId === selectedCategoryId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${item.name} harcamalarını aç`}
              onPress={() =>
                setSelectedCategoryId((current) => (current === item.categoryId ? null : item.categoryId))
              }
              style={({ pressed }) => [localStyles.categoryRow, isActive && localStyles.categoryRowActive, pressed && styles.pressed]}
              key={item.categoryId}
            >
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
              <Text style={localStyles.categoryRowCta}>{isActive ? "Harcamaları kapat" : "Harcamaları aç"}</Text>
            </Pressable>
          );
        })
      ) : (
        <EmptyPanelMessage message="Kategori dağılımı için önce fiş, işlem veya ekstre verisi eklenmeli." />
      )}
      {selectedCategory ? (
        <View style={localStyles.categoryDrawer}>
          <View style={styles.rowBetween}>
            <View style={localStyles.alertCopy}>
              <Text style={localStyles.overline}>Kategori harcamaları</Text>
              <Text style={localStyles.cardTitle}>{selectedCategory.name}</Text>
              <Text style={styles.bodyMuted}>{dashboard.periodLabel} içinde pahalıdan ucuza sıralandı.</Text>
            </View>
            <IconButton onPress={() => setSelectedCategoryId(null)} tone="muted">
              <X size={16} color={palette.ink} />
            </IconButton>
          </View>
          <View style={styles.metricGrid}>
            <MiniFact label="Toplam" value={money(selectedCategory.value)} />
            <MiniFact label="İşlem" value={`${selectedTransactions.length}`} />
            <MiniFact label="En yüksek" value={highestTransaction ? moneyWithCurrency(highestTransaction.amount, highestTransaction.currency) : "Yok"} />
          </View>
          {transactionsLoading ? (
            <View style={styles.row}>
              <ActivityIndicator color={palette.primary} size="small" />
              <Text style={[styles.bodyMuted, localStyles.profileRowText]}>İşlemler yükleniyor...</Text>
            </View>
          ) : transactionsError ? (
            <Text style={localStyles.authError}>{transactionsError}</Text>
          ) : selectedTransactions.length ? (
            <View style={localStyles.profileRowList}>
              {selectedTransactions.map((transaction) => (
                <View style={localStyles.profileRow} key={transaction.id}>
                  <View style={localStyles.alertIcon}>
                    <ReceiptText size={16} color={palette.primary} />
                  </View>
                  <View style={localStyles.alertCopy}>
                    <Text style={localStyles.cardTitle}>{transaction.merchant}</Text>
                    <Text style={styles.bodyMuted}>
                      {formatShortDate(transaction.occurredAt)} · {paymentMethodLabel(transaction.paymentMethod)}
                    </Text>
                  </View>
                  <Mono style={localStyles.cardTitle}>{moneyWithCurrency(transaction.amount, transaction.currency)}</Mono>
                </View>
              ))}
            </View>
          ) : (
            <EmptyPanelMessage message="Bu kategoride seçili dönem için işlem bulunamadı." />
          )}
        </View>
      ) : null}
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

function EmotionalDelayPanel({
  simulation,
  summary,
  history,
  actions,
  campaign,
  onChanged
}: {
  simulation: WhatIfResponse;
  summary: DecisionJournalSummary;
  history: SimulationHistoryItem[];
  actions: ActionItem[];
  campaign: HomeData["campaign"];
  onChanged: () => void;
}) {
  const delayActions = actions.filter((action) => action.type === "delay_purchase");

  return (
    <>
      <CampaignReadinessPanel campaign={campaign} />
      <WhatIfPreview simulation={simulation} summary={summary} history={history} submitLabel="Bekleme süresini hesapla" />
      <ActionCenter actions={delayActions} onChanged={onChanged} />
    </>
  );
}

function CampaignReadinessPanel({ campaign }: { campaign: HomeData["campaign"] }) {
  return (
    <Panel>
      <SectionTitle title="Kampanya skoru" meta={riskLabel(campaign.riskLevel)} />
      <View style={styles.metricGrid}>
        <MiniFact label="Skor" value={`${campaign.score}/100`} tone={riskTone(campaign.riskLevel)} />
        <MiniFact label="Dikkatli sınır" value={money(campaign.safeLimit)} tone="primary" />
        <MiniFact label="Risk seviyesi" value={riskLabel(campaign.riskLevel)} tone={riskTone(campaign.riskLevel)} />
      </View>
      {campaign.notes.length ? (
        <View style={localStyles.profileRowList}>
          {campaign.notes.map((note) => (
            <View style={styles.row} key={note}>
              <Info size={14} color={palette.primary} />
              <Text style={[styles.bodyMuted, localStyles.profileRowText]}>{note}</Text>
            </View>
          ))}
        </View>
      ) : (
        <EmptyPanelMessage message="Kampanya tetikleyicisi henüz oluşmadı." />
      )}
    </Panel>
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

function MobileFinancialProfile({
  user,
  profile,
  categories,
  onChanged
}: {
  user: AuthUserProfile;
  profile: HomeData["financialProfile"];
  categories: Category[];
  onChanged: () => void;
}) {
  const expenseCategories = useMemo(() => {
    const fromApi = categories.filter((category) => category.kind === "expense");
    return fromApi.length ? fromApi : fallbackTransactionCategories.filter((category) => category.kind === "expense");
  }, [categories]);
  const [accounts, setAccounts] = useState<Account[]>(profile.accounts);
  const [budgets, setBudgets] = useState<Budget[]>(profile.budgets);
  const [goals, setGoals] = useState<Goal[]>(profile.goals);
  const [monthlyIncome, setMonthlyIncome] = useState(user.monthlyIncome > 0 ? String(user.monthlyIncome) : "");
  const [payday, setPayday] = useState(String(user.payday));
  const [currency, setCurrency] = useState<Currency>((user.currency as Currency) || "TRY");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<Account["type"]>("debit");
  const [accountBalance, setAccountBalance] = useState("");
  const [accountCurrency, setAccountCurrency] = useState<Currency>((user.currency as Currency) || "TRY");
  const [creditLimit, setCreditLimit] = useState("");
  const [budgetCategoryId, setBudgetCategoryId] = useState(expenseCategories[0]?.id ?? "cat-other");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalDeadline, setGoalDeadline] = useState(() => localDateInputValue());
  const [fixedMerchant, setFixedMerchant] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [fixedCategoryId, setFixedCategoryId] = useState(expenseCategories[0]?.id ?? "cat-other");
  const [fixedOccurredAt, setFixedOccurredAt] = useState(() => localDateInputValue());
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const totalAccountBalance = accounts.reduce((total, account) => total + account.balance, 0);
  const totalBudget = budgets.reduce((total, budget) => total + budget.monthlyLimit, 0);

  useEffect(() => {
    setAccounts(profile.accounts);
    setBudgets(profile.budgets);
    setGoals(profile.goals);
  }, [profile.accounts, profile.budgets, profile.goals]);

  useEffect(() => {
    if (!expenseCategories.some((category) => category.id === budgetCategoryId)) {
      setBudgetCategoryId(expenseCategories[0]?.id ?? "cat-other");
    }
    if (!expenseCategories.some((category) => category.id === fixedCategoryId)) {
      setFixedCategoryId(expenseCategories[0]?.id ?? "cat-other");
    }
  }, [budgetCategoryId, expenseCategories, fixedCategoryId]);

  async function runProfileTask<T>(key: string, task: () => Promise<T>, success: string) {
    setPendingKey(key);
    setStatus(null);
    try {
      const result = await task();
      setStatus({ tone: "success", text: success });
      onChanged();
      return result;
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "İşlem tamamlanamadı." });
      return undefined;
    } finally {
      setPendingKey(null);
    }
  }

  async function save() {
    const parsedIncome = parseDecimalInput(monthlyIncome);
    const parsedPayday = Number(payday);
    if (parsedIncome === undefined || parsedIncome < 0 || !Number.isInteger(parsedPayday) || parsedPayday < 1 || parsedPayday > 31) {
      setStatus({ tone: "error", text: "Gelir sıfır veya pozitif, maaş günü 1-31 arasında olmalı." });
      return;
    }
    await runProfileTask("income", () => updateFinanceProfile({ monthlyIncome: parsedIncome, payday: parsedPayday, currency }), "Finansal profil güncellendi.");
  }

  async function addAccount() {
    const balance = parseDecimalInput(accountBalance);
    const parsedCreditLimit = parseDecimalInput(creditLimit);
    if (!accountName.trim() || balance === undefined) {
      setStatus({ tone: "error", text: "Hesap adı ve sıfır/pozitif bakiye gerekli." });
      return;
    }
    const created = await runProfileTask(
      "account",
      () =>
        createAccount({
          name: accountName.trim(),
          type: accountType,
          balance,
          currency: accountCurrency,
          creditLimit: accountType === "credit" ? parsedCreditLimit ?? 0 : undefined
        }),
      "Hesap eklendi."
    );
    if (created) {
      setAccounts((current) => [...current, created]);
      setAccountName("");
      setAccountBalance("");
      setCreditLimit("");
    }
  }

  async function addBudget() {
    const monthlyLimit = parseDecimalInput(budgetLimit);
    if (!budgetCategoryId || monthlyLimit === undefined || monthlyLimit <= 0) {
      setStatus({ tone: "error", text: "Kategori ve pozitif bütçe limiti gerekli." });
      return;
    }
    const created = await runProfileTask("budget", () => createBudget({ categoryId: budgetCategoryId, monthlyLimit }), "Bütçe eklendi.");
    if (created) {
      setBudgets((current) => [...current, created]);
      setBudgetLimit("");
    }
  }

  async function addGoal() {
    const targetAmount = parseDecimalInput(goalTarget);
    const currentAmount = parseDecimalInput(goalCurrent) ?? 0;
    if (!goalTitle.trim() || targetAmount === undefined || targetAmount <= 0) {
      setStatus({ tone: "error", text: "Hedef adı ve pozitif hedef tutarı gerekli." });
      return;
    }
    const created = await runProfileTask(
      "goal",
      () =>
        createGoal({
          title: goalTitle.trim(),
          targetAmount,
          currentAmount,
          deadline: goalDeadline
        }),
      "Hedef eklendi."
    );
    if (created) {
      setGoals((current) => [...current, created].sort((left, right) => left.deadline.localeCompare(right.deadline)));
      setGoalTitle("");
      setGoalTarget("");
      setGoalCurrent("");
      setGoalDeadline(localDateInputValue());
    }
  }

  async function addFixedExpense() {
    const amount = parseDecimalInput(fixedAmount);
    if (!fixedMerchant.trim() || amount === undefined || amount <= 0 || !fixedCategoryId) {
      setStatus({ tone: "error", text: "Sabit gider adı, kategori ve pozitif tutar gerekli." });
      return;
    }
    const created = await runProfileTask(
      "fixed",
      () =>
        createTransaction({
          merchant: fixedMerchant.trim(),
          amount,
          type: "expense",
          currency,
          categoryId: fixedCategoryId,
          occurredAt: `${fixedOccurredAt}T12:00:00.000Z`,
          paymentMethod: "transfer",
          recurring: true
        }),
      "Sabit gider tekrarlı işlem olarak eklendi."
    );
    if (created) {
      setFixedMerchant("");
      setFixedAmount("");
    }
  }

  async function removeAccount(id: string) {
    const removed = await runProfileTask("delete-account", () => deleteAccount(id), "Hesap silindi.");
    if (removed) setAccounts((current) => current.filter((account) => account.id !== removed.id));
  }

  async function removeBudget(id: string) {
    const removed = await runProfileTask("delete-budget", () => deleteBudget(id), "Bütçe silindi.");
    if (removed) setBudgets((current) => current.filter((budget) => budget.id !== removed.id));
  }

  async function removeGoal(id: string) {
    const removed = await runProfileTask("delete-goal", () => deleteGoal(id), "Hedef silindi.");
    if (removed) setGoals((current) => current.filter((goal) => goal.id !== removed.id));
  }

  return (
    <>
      <View style={styles.metricGrid}>
        <MetricCard icon={<WalletCards size={18} color={palette.primary} />} label="Hesap" value={`${accounts.length}`} caption={money(totalAccountBalance)} tone="primary" />
        <MetricCard icon={<Target size={18} color={palette.teal} />} label="Hedef" value={`${goals.length}`} caption="aktif finansal hedef" tone="teal" />
        <MetricCard icon={<ShieldAlert size={18} color={palette.warn} />} label="Bütçe" value={`${budgets.length}`} caption={money(totalBudget)} tone="warn" />
      </View>
      <Panel>
        <SectionTitle title="Gelir profili" meta="maaş / ödeme günü" />
        <View style={localStyles.formGrid}>
          <TextInput value={monthlyIncome} onChangeText={setMonthlyIncome} placeholder="Aylık gelir" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
          <TextInput value={payday} onChangeText={setPayday} placeholder="Maaş günü" placeholderTextColor={palette.muted} keyboardType="number-pad" style={[localStyles.authInput, localStyles.formInput]} />
        </View>
        <View style={localStyles.segmentedInline}>
          {(["TRY", "USD", "EUR"] as const).map((item) => (
            <Pressable key={item} onPress={() => setCurrency(item)} style={[localStyles.segmentButton, currency === item && localStyles.segmentButtonActive]}>
              <Text style={[localStyles.segmentButtonText, currency === item && localStyles.segmentButtonTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Button label={pendingKey === "income" ? "Kaydediliyor" : "Profili kaydet"} onPress={() => void save()} disabled={Boolean(pendingKey)} icon={<Check size={15} color={palette.surface} />} />
      </Panel>
      <Panel>
        <SectionTitle title="Sabit gider" meta="tekrarlı işlem" />
        <TextInput value={fixedMerchant} onChangeText={setFixedMerchant} placeholder="Kira, okul, aidat" placeholderTextColor={palette.muted} style={localStyles.authInput} />
        <View style={localStyles.formGrid}>
          <TextInput value={fixedAmount} onChangeText={setFixedAmount} placeholder="Tutar" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
          <TextInput value={fixedOccurredAt} onChangeText={setFixedOccurredAt} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={[localStyles.authInput, localStyles.formInput]} />
        </View>
        <View style={localStyles.segmentedWrap}>
          {expenseCategories.map((category) => (
            <Pressable key={category.id} onPress={() => setFixedCategoryId(category.id)} style={[localStyles.segmentButton, localStyles.segmentWrapButton, fixedCategoryId === category.id && localStyles.segmentButtonActive]}>
              <Text style={[localStyles.segmentButtonText, fixedCategoryId === category.id && localStyles.segmentButtonTextActive]}>{category.name}</Text>
            </Pressable>
          ))}
        </View>
        <Button label={pendingKey === "fixed" ? "Ekleniyor" : "Sabit gider ekle"} onPress={() => void addFixedExpense()} disabled={Boolean(pendingKey)} icon={<Plus size={15} color={palette.surface} />} />
      </Panel>
      <Panel>
        <SectionTitle title="Hesaplar" meta={`${accounts.length}`} />
        <TextInput value={accountName} onChangeText={setAccountName} placeholder="Ana vadesiz, kredi kartı" placeholderTextColor={palette.muted} style={localStyles.authInput} />
        <View style={localStyles.segmentedWrap}>
          {accountTypeOptions.map((item) => (
            <Pressable key={item.value} onPress={() => setAccountType(item.value)} style={[localStyles.segmentButton, localStyles.segmentWrapButton, accountType === item.value && localStyles.segmentButtonActive]}>
              <Text style={[localStyles.segmentButtonText, accountType === item.value && localStyles.segmentButtonTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={localStyles.formGrid}>
          <TextInput value={accountBalance} onChangeText={setAccountBalance} placeholder="Bakiye" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
          <View style={[localStyles.segmentedInline, localStyles.formInput]}>
            {(["TRY", "USD", "EUR"] as const).map((item) => (
              <Pressable key={item} onPress={() => setAccountCurrency(item)} style={[localStyles.segmentButton, accountCurrency === item && localStyles.segmentButtonActive]}>
                <Text style={[localStyles.segmentButtonText, accountCurrency === item && localStyles.segmentButtonTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {accountType === "credit" ? (
          <TextInput value={creditLimit} onChangeText={setCreditLimit} placeholder="Kredi limiti" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={localStyles.authInput} />
        ) : null}
        <Button label={pendingKey === "account" ? "Ekleniyor" : "Hesap ekle"} onPress={() => void addAccount()} disabled={Boolean(pendingKey)} icon={<Plus size={15} color={palette.surface} />} />
        <ProfileRows
          rows={accounts.map((account) => ({ id: account.id, title: account.name, meta: `${accountTypeLabel(account.type)} · ${moneyWithCurrency(account.balance, account.currency)}` }))}
          pending={pendingKey === "delete-account"}
          onDelete={(id) => void removeAccount(id)}
        />
      </Panel>
      <Panel>
        <SectionTitle title="Bütçeler" meta={`${budgets.length}`} />
        <View style={localStyles.segmentedWrap}>
          {expenseCategories.map((category) => (
            <Pressable key={category.id} onPress={() => setBudgetCategoryId(category.id)} style={[localStyles.segmentButton, localStyles.segmentWrapButton, budgetCategoryId === category.id && localStyles.segmentButtonActive]}>
              <Text style={[localStyles.segmentButtonText, budgetCategoryId === category.id && localStyles.segmentButtonTextActive]}>{category.name}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={budgetLimit} onChangeText={setBudgetLimit} placeholder="Aylık limit" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={localStyles.authInput} />
        <Button label={pendingKey === "budget" ? "Ekleniyor" : "Bütçe ekle"} onPress={() => void addBudget()} disabled={Boolean(pendingKey)} icon={<Plus size={15} color={palette.surface} />} />
        <ProfileRows
          rows={budgets.map((budget) => ({ id: budget.id, title: categoryLabel([...categories, ...fallbackTransactionCategories], budget.categoryId), meta: moneyWithCurrency(budget.monthlyLimit, currency) }))}
          pending={pendingKey === "delete-budget"}
          onDelete={(id) => void removeBudget(id)}
        />
      </Panel>
      <Panel>
        <SectionTitle title="Hedefler" meta={`${goals.length}`} />
        <TextInput value={goalTitle} onChangeText={setGoalTitle} placeholder="Acil durum fonu" placeholderTextColor={palette.muted} style={localStyles.authInput} />
        <View style={localStyles.formGrid}>
          <TextInput value={goalTarget} onChangeText={setGoalTarget} placeholder="Hedef tutarı" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
          <TextInput value={goalCurrent} onChangeText={setGoalCurrent} placeholder="Şu an biriken" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
        </View>
        <TextInput value={goalDeadline} onChangeText={setGoalDeadline} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={localStyles.authInput} />
        <Button label={pendingKey === "goal" ? "Ekleniyor" : "Hedef ekle"} onPress={() => void addGoal()} disabled={Boolean(pendingKey)} icon={<Plus size={15} color={palette.surface} />} />
        <ProfileRows
          rows={goals.map((goal) => ({ id: goal.id, title: goal.title, meta: `${moneyWithCurrency(goal.currentAmount, currency)} / ${moneyWithCurrency(goal.targetAmount, currency)} · ${goal.deadline}` }))}
          pending={pendingKey === "delete-goal"}
          onDelete={(id) => void removeGoal(id)}
        />
      </Panel>
      {status ? <Text style={status.tone === "success" ? localStyles.formSuccess : localStyles.authError}>{status.text}</Text> : null}
    </>
  );
}

function ProfileRows({
  rows,
  pending,
  onDelete
}: {
  rows: Array<{ id: string; title: string; meta: string }>;
  pending?: boolean;
  onDelete: (id: string) => void;
}) {
  if (!rows.length) return <EmptyPanelMessage message="Kayıt yok." />;
  return (
    <View style={localStyles.profileRowList}>
      {rows.map((row) => (
        <View style={localStyles.profileRow} key={row.id}>
          <View style={localStyles.alertCopy}>
            <Text style={localStyles.cardTitle}>{row.title}</Text>
            <Text style={styles.bodyMuted}>{row.meta}</Text>
          </View>
          <IconButton onPress={() => onDelete(row.id)} tone="danger">
            <Trash2 size={16} color={pending ? palette.muted : palette.danger} />
          </IconButton>
        </View>
      ))}
    </View>
  );
}

function MobileGoalsPlanner({ initialPlanning, onChanged }: { initialPlanning: PlanningOverview; onChanged: () => void }) {
  const [planning, setPlanning] = useState(initialPlanning);
  const [monthlyAmount, setMonthlyAmount] = useState(goalAmount(initialPlanning.savingsPlan.monthly));
  const [yearlyAmount, setYearlyAmount] = useState(goalAmount(initialPlanning.savingsPlan.yearly));
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");
  const [goalDeadline, setGoalDeadline] = useState(() => localDateInputValue(addMonths(new Date(), 6)));
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>(() => budgetInputMap(initialPlanning));
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [advice, setAdvice] = useState<GoalAdviceResponse | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(true);
  const [adviceVersion, setAdviceVersion] = useState(0);
  const customGoals = useMemo(() => planning.goals.filter((goal) => !isSavingsGoal(goal)), [planning.goals]);

  useEffect(() => {
    setPlanning(initialPlanning);
    setMonthlyAmount(goalAmount(initialPlanning.savingsPlan.monthly));
    setYearlyAmount(goalAmount(initialPlanning.savingsPlan.yearly));
    setBudgetInputs(budgetInputMap(initialPlanning));
  }, [initialPlanning]);

  useEffect(() => {
    let cancelled = false;
    setAdviceLoading(true);
    void getGoalAdvice()
      .then((result) => {
        if (!cancelled) setAdvice(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setAdvice({
            summary: error instanceof Error ? error.message : "Hedef tavsiyesi şu anda alınamadı.",
            actions: [],
            generatedAt: new Date().toISOString(),
            source: "unavailable"
          });
        }
      })
      .finally(() => {
        if (!cancelled) setAdviceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adviceVersion]);

  async function saveSavingsPlan() {
    const monthly = parseDecimalInput(monthlyAmount);
    const yearly = parseDecimalInput(yearlyAmount);
    if (monthly === undefined || yearly === undefined) {
      setStatus({ tone: "error", text: "Aylık ve yıllık birikim tutarı sayı olmalı." });
      return;
    }
    setPendingKey("savings");
    setStatus(null);
    try {
      const savingsPlan = await upsertSavingsPlan({ monthlyAmount: monthly, yearlyAmount: yearly });
      setPlanning((current) => ({
        ...current,
        savingsPlan,
        goals: mergeGoals(current.goals, [savingsPlan.monthly, savingsPlan.yearly].filter((goal): goal is Goal => Boolean(goal)))
      }));
      setStatus({ tone: "success", text: "Birikim planı kaydedildi." });
      onChanged();
      refreshAdvice();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Birikim planı kaydedilemedi." });
    } finally {
      setPendingKey(null);
    }
  }

  async function addPlannerGoal() {
    const targetAmount = parseDecimalInput(goalTarget);
    const currentAmount = parseDecimalInput(goalCurrent || "0");
    if (!goalTitle.trim() || targetAmount === undefined || targetAmount <= 0 || currentAmount === undefined || currentAmount < 0) {
      setStatus({ tone: "error", text: "Hedef adı, pozitif hedef tutarı ve geçerli mevcut birikim gerekli." });
      return;
    }
    setPendingKey("goal");
    setStatus(null);
    try {
      const goal = await createGoal({ title: goalTitle.trim(), targetAmount, currentAmount, deadline: goalDeadline });
      setPlanning((current) => ({ ...current, goals: mergeGoals(current.goals, [goal]) }));
      setGoalTitle("");
      setGoalTarget("");
      setGoalCurrent("");
      setGoalDeadline(localDateInputValue(addMonths(new Date(), 6)));
      setStatus({ tone: "success", text: "Hedef eklendi." });
      onChanged();
      refreshAdvice();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Hedef eklenemedi." });
    } finally {
      setPendingKey(null);
    }
  }

  async function saveBudgetLimit(categoryId: string) {
    const value = budgetInputs[categoryId] ?? "";
    const monthlyLimit = parseDecimalInput(value);
    if (monthlyLimit === undefined) {
      setStatus({ tone: "error", text: "Kategori limiti sayı olmalı." });
      return;
    }
    setPendingKey(categoryId);
    setStatus(null);
    try {
      const budget = await upsertBudget({ categoryId, monthlyLimit });
      setPlanning((current) => ({
        ...current,
        budgets: [budget, ...current.budgets.filter((item) => item.id !== budget.id && item.categoryId !== budget.categoryId)]
      }));
      setStatus({ tone: "success", text: "Kategori limiti kaydedildi." });
      onChanged();
      refreshAdvice();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Kategori limiti kaydedilemedi." });
    } finally {
      setPendingKey(null);
    }
  }

  function refreshAdvice() {
    setAdviceVersion((current) => current + 1);
  }

  return (
    <>
      <View style={styles.metricGrid}>
        <MetricCard icon={<PiggyBank size={18} color={palette.primary} />} label="Aylık birikim" value={money(displayAmount(monthlyAmount))} caption="simülasyonlarda dikkate alınır" tone="primary" />
        <MetricCard icon={<CalendarDays size={18} color={palette.teal} />} label="Yıllık birikim" value={money(displayAmount(yearlyAmount))} caption="planlanan birikim" tone="teal" />
        <MetricCard icon={<Target size={18} color={palette.warn} />} label="Aktif hedef" value={`${customGoals.length}`} caption="kendi hedeflerin" tone="warn" />
      </View>

      <Panel>
        <View style={styles.rowBetween}>
          <SectionTitle title="Hedef koçu" meta={adviceLoading ? "hazırlanıyor" : advice?.source === "llm" ? "kişisel yorum" : "durum"} />
          <IconButton onPress={refreshAdvice} tone="primary">
            <RefreshCw size={16} color={palette.primary} />
          </IconButton>
        </View>
        <Text style={styles.bodyMuted}>
          {adviceLoading
            ? "Hedeflerin ve limitlerin okunuyor. Birazdan kısa ve uygulanabilir bir yol haritası hazırlanacak."
            : advice?.summary ?? "Hedef tavsiyesi şu anda hazırlanamadı."}
        </Text>
        {advice && advice.actions.length ? (
          <View style={localStyles.profileRowList}>
            {advice.actions.map((action) => (
              <View style={localStyles.profileRow} key={action}>
                <Sparkles size={16} color={palette.primary} />
                <Text style={[styles.body, localStyles.profileRowText]}>{action}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Panel>

      <Panel>
        <SectionTitle title="Birikim planı" meta="aylık / yıllık" />
        <TextInput value={monthlyAmount} onChangeText={setMonthlyAmount} placeholder="Aylık biriktirme miktarı" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={localStyles.authInput} />
        <TextInput value={yearlyAmount} onChangeText={setYearlyAmount} placeholder="Yıllık biriktirme miktarı" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={localStyles.authInput} />
        <Button label={pendingKey === "savings" ? "Kaydediliyor" : "Birikimi kaydet"} onPress={() => void saveSavingsPlan()} disabled={Boolean(pendingKey)} icon={<PiggyBank size={15} color={palette.surface} />} />
      </Panel>

      <Panel>
        <SectionTitle title="Kendi hedefin" meta="hedef tutarı" />
        <TextInput value={goalTitle} onChangeText={setGoalTitle} placeholder="Araba, tatil, acil durum..." placeholderTextColor={palette.muted} style={localStyles.authInput} />
        <View style={localStyles.formGrid}>
          <TextInput value={goalTarget} onChangeText={setGoalTarget} placeholder="Hedef tutarı" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
          <TextInput value={goalCurrent} onChangeText={setGoalCurrent} placeholder="Şu an biriken" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
        </View>
        <TextInput value={goalDeadline} onChangeText={setGoalDeadline} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={localStyles.authInput} />
        <Button label={pendingKey === "goal" ? "Ekleniyor" : "Hedef ekle"} onPress={() => void addPlannerGoal()} disabled={Boolean(pendingKey)} icon={<Plus size={15} color={palette.surface} />} />
      </Panel>

      <Panel>
        <SectionTitle title="Kategori harcama limitleri" meta="aylık limit" />
        {planning.categories.map((category) => (
          <View style={localStyles.budgetLimitRow} key={category.id}>
            <View style={[localStyles.categorySwatch, { backgroundColor: category.color }]} />
            <View style={localStyles.alertCopy}>
              <Text style={localStyles.cardTitle}>{category.name}</Text>
              <Text style={styles.bodyMuted}>{budgetCaption(planning, category.id)}</Text>
            </View>
            <TextInput
              value={budgetInputs[category.id] ?? ""}
              onChangeText={(value) => setBudgetInputs((current) => ({ ...current, [category.id]: value }))}
              placeholder="Limit"
              placeholderTextColor={palette.muted}
              keyboardType="decimal-pad"
              style={[localStyles.authInput, localStyles.budgetLimitInput]}
            />
            <Button label={pendingKey === category.id ? "..." : "Kaydet"} variant="secondary" style={localStyles.budgetLimitButton} disabled={Boolean(pendingKey)} onPress={() => void saveBudgetLimit(category.id)} />
          </View>
        ))}
      </Panel>

      <Panel>
        <SectionTitle title="Aktif hedefler" meta={`${customGoals.length}`} />
        {customGoals.length ? (
          customGoals.map((goal) => {
            const percent = Math.round((goal.currentAmount / goal.targetAmount) * 100);
            return (
              <View style={localStyles.goalCard} key={goal.id}>
                <View style={styles.rowBetween}>
                  <Text style={localStyles.cardTitle}>{goal.title}</Text>
                  <Badge label={`%${percent}`} tone="teal" />
                </View>
                <Text style={styles.bodyMuted}>
                  {money(goal.currentAmount)} / {money(goal.targetAmount)} · {goal.deadline}
                </Text>
                <ProgressBar value={percent} tone="teal" />
              </View>
            );
          })
        ) : (
          <EmptyPanelMessage message="Kendi hedefini eklediğinde burada takip edebilirsin." />
        )}
      </Panel>
      {status ? <Text style={status.tone === "success" ? localStyles.formSuccess : localStyles.authError}>{status.text}</Text> : null}
    </>
  );
}

function DocumentHistoryPanel({ documents }: { documents: DocumentHistoryItem[] }) {
  const [selected, setSelected] = useState<DocumentDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openDocument(documentId: string) {
    if (selected?.id === documentId) {
      setSelected(null);
      return;
    }
    setLoadingId(documentId);
    setError(null);
    try {
      setSelected(await loadDocumentDetail(documentId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Belge detayı alınamadı.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Panel>
      <SectionTitle title="Belge geçmişi" meta={`${documents.length}`} />
      {documents.length ? (
        documents.slice(0, 8).map((document) => (
          <Pressable accessibilityRole="button" onPress={() => void openDocument(document.id)} style={({ pressed }) => [localStyles.documentHistoryRow, pressed && styles.pressed]} key={document.id}>
            <View style={localStyles.alertIcon}>{document.status === "imported" ? <CheckCircle2 size={18} color={palette.success} /> : <FileText size={18} color={palette.primary} />}</View>
            <View style={localStyles.alertCopy}>
              <Text style={localStyles.cardTitle}>{documentTitle(document)}</Text>
              <Text style={styles.bodyMuted}>
                {document.kind} · {document.status} · {formatShortDate(document.createdAt)}
              </Text>
              {loadingId === document.id ? <Text style={styles.bodyMuted}>Detay yükleniyor...</Text> : null}
              {document.warnings.length ? (
                <View style={styles.row}>
                  <AlertTriangle size={13} color={palette.warn} />
                  <Text style={[styles.bodyMuted, localStyles.profileRowText]}>{document.warnings[0]}</Text>
                </View>
              ) : null}
            </View>
            <View style={localStyles.documentAmount}>
              <Mono style={localStyles.cardTitle}>{document.totalAmount !== undefined ? money(document.totalAmount) : "-"}</Mono>
              <Text style={styles.bodyMuted}>{document.itemCount} kalem</Text>
              {document.lowConfidenceCount ? <Text style={styles.bodyMuted}>{document.lowConfidenceCount} düşük güven</Text> : null}
            </View>
          </Pressable>
        ))
      ) : (
        <EmptyPanelMessage message="Fiş veya ekstre işlendiğinde sonuç, uyarı ve import durumu burada görünür." />
      )}
      {error ? <Text style={localStyles.authError}>{error}</Text> : null}
      {selected ? <DocumentDetailPanel detail={selected} /> : null}
    </Panel>
  );
}

function DocumentDetailPanel({ detail }: { detail: DocumentDetail }) {
  return (
    <View style={localStyles.documentDetailPanel}>
      <SectionTitle title={documentTitle(detail)} meta={`${detail.itemCount} kalem`} />
      <View style={styles.metricGrid}>
        <MiniFact label="Durum" value={detail.status} tone={detail.status === "imported" ? "success" : "primary"} />
        <MiniFact label="Toplam" value={detail.totalAmount !== undefined ? money(detail.totalAmount) : "-"} />
        <MiniFact label="Kalem" value={`${detail.itemCount}`} />
        <MiniFact label="Düşük güven" value={String(detail.lowConfidenceCount)} tone={detail.lowConfidenceCount > 0 ? "warn" : "success"} />
      </View>
      <View style={localStyles.documentStatusGrid}>
        <View style={localStyles.documentStatusItem}>
          <CheckCircle2 size={16} color={palette.success} />
          <View style={localStyles.alertCopy}>
            <Text style={localStyles.miniLabel}>Import</Text>
            <Text style={localStyles.cardTitle}>
              {detail.importedAt ? formatShortDate(detail.importedAt) : "Henüz import edilmedi"}
            </Text>
          </View>
        </View>
        <View style={localStyles.documentStatusItem}>
          <FileText size={16} color={palette.primary} />
          <View style={localStyles.alertCopy}>
            <Text style={localStyles.miniLabel}>Kaynak</Text>
            <Text style={localStyles.cardTitle}>{detail.sourceType ?? detail.kind}</Text>
          </View>
        </View>
      </View>
      {detail.warnings.map((warning, index) => (
        <View style={styles.row} key={`${warning}-${index}`}>
          <AlertTriangle size={14} color={palette.warn} />
          <Text style={[styles.bodyMuted, localStyles.profileRowText]}>{warning}</Text>
        </View>
      ))}
      {detail.items.length ? (
        detail.items.map((item, index) => (
          <View style={localStyles.profileRow} key={`${item.label}-${index}`}>
            <View style={localStyles.alertCopy}>
              <Text style={localStyles.cardTitle}>{item.merchant ?? item.label}</Text>
              <Text style={styles.bodyMuted}>
                {[item.occurredAt, item.categoryName, item.paymentMethod].filter(Boolean).join(" · ") || "Detay yok"}
              </Text>
              {item.duplicate ? <Badge label="Yinelenen" tone="warn" /> : null}
            </View>
            <View style={localStyles.documentAmount}>
              <Mono style={localStyles.cardTitle}>{item.amount !== undefined ? money(item.amount) : "-"}</Mono>
              {item.confidence !== undefined ? <Text style={styles.bodyMuted}>%{Math.round(item.confidence * 100)} güven</Text> : null}
            </View>
          </View>
        ))
      ) : (
        <EmptyPanelMessage message="Bu belgede gösterilecek satır detayı yok." />
      )}
    </View>
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
      <SectionTitle title="Gelir ve Gider Akışı" meta="maaş/tek seferlik" />
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
        <TextInput value={merchant} onChangeText={setMerchant} placeholder={type === "income" ? "Gelir kaynağı veya açıklama" : "Satıcı veya açıklama"} placeholderTextColor={palette.muted} style={[localStyles.authInput, localStyles.formInput]} />
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
        <Text style={[localStyles.segmentButtonText, recurring && localStyles.segmentButtonTextActive]}>{type === "income" ? "Tekrar eden gelir" : "Tekrar eden işlem"}</Text>
      </Pressable>
      <Button label={pending ? "Ekleniyor" : "İşlem ekle"} onPress={() => void addManual()} disabled={pending} icon={<Plus size={15} color={palette.surface} />} />
      {status ? <Text style={status.includes("gerekli") || status.includes("zorunlu") || status.includes("olmalı") || status.includes("edilemedi") ? localStyles.authError : localStyles.formSuccess}>{status}</Text> : null}
    </Panel>
  );
}

function WhatIfPreview({
  simulation,
  summary,
  history,
  submitLabel
}: {
  simulation: WhatIfResponse;
  summary: DecisionJournalSummary;
  history: SimulationHistoryItem[];
  submitLabel: string;
}) {
  const [whatIf, setWhatIf] = useState(simulation);
  const [journalSummary, setJournalSummary] = useState(summary);
  const [journalHistory, setJournalHistory] = useState(history);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [decisionDate, setDecisionDate] = useState(() => localDateInputValue());
  const [categoryId, setCategoryId] = useState(simulation.resolvedCategoryId ?? "cat-other");
  const [categories, setCategories] = useState<Category[]>(fallbackTransactionCategories.filter((category) => category.kind === "expense"));
  const [finalAmount, setFinalAmount] = useState("");
  const [pending, setPending] = useState<"simulate" | UserDecisionAction | null>(null);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const delayMinutes = whatIf.emotionalDelayMinutes;
  const recentDecisions = journalHistory.filter((item) => item.decisionEvents.length > 0).slice(0, 6);

  useEffect(() => {
    setWhatIf(simulation);
    setJournalSummary(summary);
    setJournalHistory(history);
    setCategoryId(simulation.resolvedCategoryId ?? "cat-other");
  }, [history, simulation, summary]);

  useEffect(() => {
    void loadCategories("expense")
      .then((items) => {
        const next = items.length ? items : fallbackTransactionCategories.filter((category) => category.kind === "expense");
        setCategories(next);
        if (!next.some((category) => category.id === categoryId)) {
          setCategoryId(next.find((category) => category.id === "cat-other")?.id ?? next[0]?.id ?? "");
        }
      })
      .catch(() => setCategories(fallbackTransactionCategories.filter((category) => category.kind === "expense")));
  }, []);

  async function submitSimulation() {
    const parsedAmount = parseDecimalInput(amount);
    if (parsedAmount === undefined || parsedAmount <= 0) {
      setStatus({ tone: "error", text: "Pozitif bir harcama tutarı gir." });
      return;
    }
    if (!categoryId) {
      setStatus({ tone: "error", text: "Kategori seçimi gerekli." });
      return;
    }
    setPending("simulate");
    setStatus(null);
    try {
      const result = await runWhatIf({
        amount: parsedAmount,
        categoryId,
        decisionDate,
        description: description.trim() || undefined,
        timeZone: "Europe/Istanbul"
      });
      setWhatIf(result);
      setStatus({ tone: "success", text: "Senaryo güncellendi." });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Senaryo hesaplanamadı." });
    } finally {
      setPending(null);
    }
  }

  async function recordDecision(userAction: UserDecisionAction) {
    if (!whatIf.simulationId) {
      setStatus({ tone: "error", text: "Önce tutarlı bir senaryo hesapla; boş başlangıç senaryosu karar günlüğüne yazılmaz." });
      return;
    }
    const parsedFinalAmount = userAction === "reduced" ? parseDecimalInput(finalAmount) : undefined;
    if (userAction === "reduced" && (parsedFinalAmount === undefined || parsedFinalAmount <= 0)) {
      setStatus({ tone: "error", text: "Azaltılmış karar için yeni tutarı gir." });
      return;
    }
    setPending(userAction);
    setStatus(null);
    try {
      await postDecisionEvent(whatIf.simulationId, { userAction, finalAmount: parsedFinalAmount });
      const [items, nextSummary] = await Promise.all([loadSimulationHistory(), loadDecisionSummary()]);
      setJournalHistory(items);
      setJournalSummary(nextSummary);
      setFinalAmount("");
      setStatus({ tone: "success", text: "Karar günlüğe işlendi." });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Karar kaydedilemedi." });
    } finally {
      setPending(null);
    }
  }

  return (
    <Panel>
      <SectionTitle title="Karar girdisi" meta="canlı senaryo" />
      <View style={localStyles.formGrid}>
        <TextInput value={amount} onChangeText={setAmount} placeholder="Tutar" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
        <TextInput value={decisionDate} onChangeText={setDecisionDate} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={[localStyles.authInput, localStyles.formInput]} />
      </View>
      <View style={localStyles.segmentedWrap}>
        {categories.map((category) => (
          <Pressable key={category.id} onPress={() => setCategoryId(category.id)} style={[localStyles.segmentButton, localStyles.segmentWrapButton, categoryId === category.id && localStyles.segmentButtonActive]}>
            <Text style={[localStyles.segmentButtonText, categoryId === category.id && localStyles.segmentButtonTextActive]}>{category.name}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput value={description} onChangeText={setDescription} placeholder="Kıyafet, telefon, tatil..." placeholderTextColor={palette.muted} style={localStyles.authInput} />
      <Button label={pending === "simulate" ? "Hesaplanıyor" : submitLabel} onPress={() => void submitSimulation()} disabled={Boolean(pending)} icon={<Sparkles size={15} color={palette.surface} />} />

      <SectionTitle title="What-If Senaryosu" meta={delayMinutes ? "Emotional Delay" : "Veri durumu"} />
      <Text style={localStyles.quote}>“{whatIf.question}”</Text>
      {whatIf.cards.length ? (
        <>
          <View style={styles.wrapRow}>
            {whatIf.cards.map((card) => (
              <Badge key={card.id} label={money(card.spendAmount)} tone={card.id === "safe" ? "teal" : card.id === "risky" ? "danger" : "primary"} />
            ))}
          </View>
          {whatIf.cards.map((card) => (
            <ScenarioCardView key={card.id} card={card} />
          ))}
          <WhatIfMetaPanel whatIf={whatIf} />
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
      <SectionTitle title="Karar Günlüğü" meta={`${journalSummary.decidedScenarios}/${journalSummary.totalScenarios} karar`} />
      <View style={localStyles.dnaGrid}>
        <MiniSignal label="Korunan nakit" value={money(journalSummary.netProtectedCash)} tone={journalSummary.netProtectedCash >= 0 ? "teal" : "danger"} />
        <MiniSignal label="Ertelenen/iptal" value={`${journalSummary.delayedCount + journalSummary.cancelledCount}`} tone="primary" />
        <MiniSignal label="Azaltılan" value={`${journalSummary.reducedCount}`} tone="warn" />
        <MiniSignal label="Sağlık etkisi" value={`${journalSummary.healthAdjustment >= 0 ? "+" : ""}${journalSummary.healthAdjustment}`} tone={journalSummary.healthAdjustment >= 0 ? "teal" : "danger"} />
      </View>
      <Text style={styles.bodyMuted}>{journalSummary.insight}</Text>
      <View style={localStyles.actionButtons}>
        <Button label={pending === "bought" ? "..." : "Aldım"} variant="secondary" style={localStyles.actionButton} disabled={Boolean(pending) || !whatIf.simulationId} onPress={() => void recordDecision("bought")} icon={<CheckCircle2 size={15} color={palette.primary} />} />
        <Button label={pending === "delayed" ? "..." : "Erteledim"} variant="secondary" style={localStyles.actionButton} disabled={Boolean(pending) || !whatIf.simulationId} onPress={() => void recordDecision("delayed")} icon={<Clock3 size={15} color={palette.primary} />} />
        <Button label={pending === "cancelled" ? "..." : "Vazgeçtim"} variant="danger" style={localStyles.actionButton} disabled={Boolean(pending) || !whatIf.simulationId} onPress={() => void recordDecision("cancelled")} icon={<X size={15} color={palette.danger} />} />
      </View>
      <View style={localStyles.formGrid}>
        <TextInput value={finalAmount} onChangeText={setFinalAmount} placeholder="Azaltılmış tutar" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
        <Button label={pending === "reduced" ? "..." : "Azalttım"} variant="secondary" style={localStyles.formInput} disabled={Boolean(pending) || !whatIf.simulationId} onPress={() => void recordDecision("reduced")} />
      </View>
      <Button label={pending === "planned" ? "Kaydediliyor" : "Planladım"} variant="ghost" disabled={Boolean(pending) || !whatIf.simulationId} onPress={() => void recordDecision("planned")} />
      {status ? <Text style={status.tone === "success" ? localStyles.formSuccess : localStyles.authError}>{status.text}</Text> : null}
      {recentDecisions.length ? (
        recentDecisions.map((item) => {
          const latest = item.decisionEvents[0];
          return (
            <View style={localStyles.scenarioCard} key={item.id}>
              <View style={styles.rowBetween}>
                <View style={localStyles.businessHeroCopy}>
                  <History size={16} color={palette.primary} />
                  <Badge label={decisionActionLabel(latest.userAction)} tone={latest.userAction === "bought" ? "danger" : latest.userAction === "planned" ? "primary" : "teal"} />
                </View>
                <Mono style={localStyles.scenarioAmount}>{money(latest.finalAmount ?? latest.originalAmount)}</Mono>
              </View>
              <Text style={styles.bodyMuted}>{item.question}</Text>
            </View>
          );
        })
      ) : (
        <EmptyPanelMessage message="Senaryo sonucu işaretlediğinde mobil karar günlüğü burada dolar." />
      )}
    </Panel>
  );
}

function decisionActionLabel(action: SimulationHistoryItem["decisionEvents"][number]["userAction"]) {
  if (action === "bought") return "Aldım";
  if (action === "delayed") return "Erteledim";
  if (action === "cancelled") return "Vazgeçtim";
  if (action === "reduced") return "Azalttım";
  return "Planladım";
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
      <View style={localStyles.dnaGrid}>
        <MiniFact label="Borç etkisi" value={money(card.debtImpact)} tone={card.debtImpact > 0 ? "danger" : "success"} />
        <MiniFact label="Tasarruf etkisi" value={`%${Math.round(card.savingsImpactPercent)}`} tone={card.savingsImpactPercent < 0 ? "danger" : "teal"} />
      </View>
      <Text style={styles.body}>{card.recommendation}</Text>
      {card.reasons?.length ? (
        <View style={localStyles.profileRowList}>
          {card.reasons.map((reason) => (
            <View style={styles.row} key={reason}>
              <Info size={13} color={palette.primary} />
              <Text style={[styles.bodyMuted, localStyles.profileRowText]}>{reason}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {card.warning ? (
        <View style={localStyles.warningCard}>
          <AlertTriangle size={14} color={palette.danger} />
          <Text style={[styles.bodyMuted, localStyles.profileRowText, { color: palette.danger, fontWeight: "700" }]}>{card.warning}</Text>
        </View>
      ) : null}
    </View>
  );
}

function WhatIfMetaPanel({ whatIf }: { whatIf: WhatIfResponse }) {
  const cashflow = whatIf.cashflow;
  const hasAssumptions = whatIf.assumptions.length > 0;
  const missing = whatIf.missingData ?? [];
  return (
    <Panel>
      <SectionTitle title="What-if veri güveni" meta={confidenceCaption(whatIf.dataConfidenceLevel, whatIf.dataConfidence)} />
      <View style={styles.metricGrid}>
        <MiniFact label="Dikkatli sınır" value={money(whatIf.safeLimit)} tone="primary" />
        <MiniFact label="Emotional Delay" value={`${whatIf.emotionalDelayMinutes || 0} dk`} tone="warn" />
        <MiniFact label="Veri güveni" value={confidenceCaption(whatIf.dataConfidenceLevel, whatIf.dataConfidence)} tone="teal" />
        <MiniFact label="Eksik veri" value={`${missing.length}`} tone={missing.length ? "warn" : "success"} />
      </View>
      {hasAssumptions ? (
        <View style={localStyles.profileRowList}>
          {whatIf.assumptions.map((assumption) => (
            <View style={styles.row} key={assumption}>
              <Info size={14} color={palette.primary} />
              <Text style={[styles.bodyMuted, localStyles.profileRowText]}>{assumption}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {missing.length ? (
        <View style={localStyles.segmentedWrap}>
          {missing.map((item) => (
            <Badge key={item} label={item} tone="warn" />
          ))}
        </View>
      ) : null}
      {cashflow ? (
        <>
          <SectionTitle title="Nakit akışı" meta={money(cashflow.availableCash)} />
          <View style={styles.metricGrid}>
            <MiniFact label="Mevcut bakiye" value={money(cashflow.currentBalance)} />
            <MiniFact label="Beklenen gelir" value={money(cashflow.expectedIncomeUntilMonthEnd)} tone="success" />
            <MiniFact label="Sabit gider" value={money(cashflow.fixedExpensesDue)} tone="warn" />
            <MiniFact label="Borç ödemesi" value={money(cashflow.debtPaymentsDue)} tone="danger" />
            <MiniFact label="Planlı birikim" value={money(cashflow.plannedSavings)} tone="teal" />
            <MiniFact label="Maaşa kalan" value={cashflow.daysUntilNextIncome === undefined ? "Yok" : `${cashflow.daysUntilNextIncome} gün`} />
          </View>
        </>
      ) : (
        <EmptyPanelMessage message="Nakit akışı detayı için yeterli gelir/gider tarihi yok." />
      )}
    </Panel>
  );
}

function confidenceCaption(level?: string, score?: number) {
  if (level === "high") return "Yüksek";
  if (level === "medium") return "Orta";
  if (level === "low") return "Düşük";
  if (typeof score === "number") return `%${Math.round(score * 100)}`;
  return "Veri yok";
}

function SubscriptionHunter({ leaks, subscriptions, onChanged }: { leaks: SubscriptionLeak[]; subscriptions: Subscription[]; onChanged: () => void }) {
  const [items, setItems] = useState(subscriptions);
  const [categories, setCategories] = useState<Category[]>(fallbackTransactionCategories.filter((category) => category.kind === "expense"));
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("cat-subscription");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [cadence, setCadence] = useState<Subscription["cadence"]>("monthly");
  const [nextExpectedAt, setNextExpectedAt] = useState(() => localDateInputValue());
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const total = leaks.reduce((sum, leak) => sum + leak.monthlyImpact, 0);

  useEffect(() => {
    setItems(subscriptions);
  }, [subscriptions]);

  useEffect(() => {
    void loadCategories("expense")
      .then((result) => {
        const next = result.length ? result : fallbackTransactionCategories.filter((category) => category.kind === "expense");
        setCategories(next);
        setCategoryId(next.find((category) => category.id === "cat-subscription")?.id ?? next[0]?.id ?? "");
      })
      .catch(() => setCategories(fallbackTransactionCategories.filter((category) => category.kind === "expense")));
  }, []);

  async function addSubscription() {
    const parsedAmount = parseDecimalInput(amount);
    if (!merchant.trim() || parsedAmount === undefined || parsedAmount <= 0 || !categoryId) {
      setStatus({ tone: "error", text: "Abonelik adı, kategori ve pozitif tutar gerekli." });
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      const created = await createSubscription({
        merchant: merchant.trim(),
        amount: parsedAmount,
        categoryId,
        currency,
        cadence,
        nextExpectedAt
      });
      setItems((current) => [created, ...current]);
      setMerchant("");
      setAmount("");
      setNextExpectedAt(localDateInputValue());
      setStatus({ tone: "success", text: "Abonelik eklendi." });
      onChanged();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Abonelik eklenemedi." });
    } finally {
      setPending(false);
    }
  }

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
      <SectionTitle title="Abonelik ekle" meta="manuel kayıt" />
      <TextInput value={merchant} onChangeText={setMerchant} placeholder="Netflix, Spotify, bulut depolama" placeholderTextColor={palette.muted} style={localStyles.authInput} />
      <View style={localStyles.formGrid}>
        <TextInput value={amount} onChangeText={setAmount} placeholder="Tutar" placeholderTextColor={palette.muted} keyboardType="decimal-pad" style={[localStyles.authInput, localStyles.formInput]} />
        <TextInput value={nextExpectedAt} onChangeText={setNextExpectedAt} placeholder="YYYY-MM-DD" placeholderTextColor={palette.muted} style={[localStyles.authInput, localStyles.formInput]} />
      </View>
      <View style={localStyles.segmentedWrap}>
        {categories.map((category) => (
          <Pressable key={category.id} onPress={() => setCategoryId(category.id)} style={[localStyles.segmentButton, localStyles.segmentWrapButton, categoryId === category.id && localStyles.segmentButtonActive]}>
            <Text style={[localStyles.segmentButtonText, categoryId === category.id && localStyles.segmentButtonTextActive]}>{category.name}</Text>
          </Pressable>
        ))}
      </View>
      <View style={localStyles.formGrid}>
        <View style={[localStyles.segmentedInline, localStyles.formInput]}>
          {(["TRY", "USD", "EUR"] as const).map((item) => (
            <Pressable key={item} onPress={() => setCurrency(item)} style={[localStyles.segmentButton, currency === item && localStyles.segmentButtonActive]}>
              <Text style={[localStyles.segmentButtonText, currency === item && localStyles.segmentButtonTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[localStyles.segmentedInline, localStyles.formInput]}>
          {(["monthly", "yearly"] as const).map((item) => (
            <Pressable key={item} onPress={() => setCadence(item)} style={[localStyles.segmentButton, cadence === item && localStyles.segmentButtonActive]}>
              <Text style={[localStyles.segmentButtonText, cadence === item && localStyles.segmentButtonTextActive]}>{item === "monthly" ? "Aylık" : "Yıllık"}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Button label={pending ? "Ekleniyor" : "Abonelik ekle"} onPress={() => void addSubscription()} disabled={pending} icon={<Plus size={15} color={palette.surface} />} />
      {status ? <Text style={status.tone === "success" ? localStyles.formSuccess : localStyles.authError}>{status.text}</Text> : null}

      <SectionTitle title="Abonelik yönetimi" meta={`${items.length} kayıt`} />
      {items.length ? (
        items.map((subscription) => <SubscriptionStatusCard key={subscription.id} subscription={subscription} onChanged={onChanged} />)
      ) : (
        <EmptyPanelMessage message="Ekstre veya manuel kayıt sonrası abonelikler burada yönetilir." />
      )}
    </Panel>
  );
}

function SubscriptionStatusCard({ subscription, onChanged }: { subscription: Subscription; onChanged: () => void }) {
  const [pending, setPending] = useState<SubscriptionStatus | null>(null);
  const [status, setStatus] = useState(subscription.status);

  async function update(nextStatus: SubscriptionStatus) {
    setPending(nextStatus);
    try {
      const updated = await updateSubscription(subscription.id, { status: nextStatus });
      setStatus(updated.status);
      onChanged();
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={localStyles.leakCard}>
      <View style={styles.rowBetween}>
        <View style={localStyles.alertCopy}>
          <Text style={localStyles.cardTitle}>{subscription.merchant}</Text>
          <Text style={styles.bodyMuted}>
            {money(subscription.amount)} / {subscription.cadence === "yearly" ? "yıl" : "ay"}
            {subscription.nextExpectedAt ? ` · sonraki ${subscription.nextExpectedAt}` : ""}
          </Text>
        </View>
        <Badge label={subscriptionStatusLabel(status)} tone={status === "cancelled" ? "danger" : status === "ignored" ? "warn" : "teal"} />
      </View>
      <View style={localStyles.actionButtons}>
        <Button label={pending === "active" ? "..." : "Aktif"} variant="secondary" style={localStyles.actionButton} disabled={Boolean(pending)} onPress={() => void update("active")} />
        <Button label={pending === "watching" ? "..." : "İzle"} variant="secondary" style={localStyles.actionButton} disabled={Boolean(pending)} onPress={() => void update("watching")} />
        <Button label={pending === "ignored" ? "..." : "Yok say"} variant="secondary" style={localStyles.actionButton} disabled={Boolean(pending)} onPress={() => void update("ignored")} />
        <Button label={pending === "cancelled" ? "..." : "İptal"} variant="danger" style={localStyles.actionButton} disabled={Boolean(pending)} onPress={() => void update("cancelled")} />
      </View>
    </View>
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
  const [activeSection, setActiveSection] = useState<BusinessMobileSection>("twin");
  const insights = useMemo(() => buildBusinessInsights(business, [...dashboard.upcomingPayments, ...dashboard.expectedCollections], customers, scores), [business, customers, dashboard.expectedCollections, dashboard.upcomingPayments, scores]);
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
        <SectionTitle title="KOBİ bölümleri" meta="web parity" />
        <View style={localStyles.segmentedWrap}>
          {businessSectionOptions.map((option) => (
            <Pressable key={option.value} onPress={() => setActiveSection(option.value)} style={[localStyles.segmentButton, localStyles.segmentWrapButton, activeSection === option.value && localStyles.segmentButtonActive]}>
              <Text style={[localStyles.segmentButtonText, activeSection === option.value && localStyles.segmentButtonTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </Panel>

      <BusinessSummaryMetrics summary={insights.summary} />

      {activeSection === "twin" ? <BusinessTwinPanel insights={insights} /> : null}
      {activeSection === "dna" ? <BusinessDnaPanel dna={insights.businessDna} /> : null}
      {activeSection === "cashflow" ? <BusinessCashflowPanel points={insights.cashflow} /> : null}
      {activeSection === "coverage" ? <BusinessCoveragePanel coverage={insights.coverage} /> : null}
      {activeSection === "collections" ? <BusinessCollectionPriorityPanel priorities={insights.collectionPriorities} /> : null}
      {activeSection === "scenarios" ? <BusinessScenarioPanel business={business} dashboard={dashboard} scenarios={insights.scenarios} /> : null}
      {activeSection === "assistant" ? <BusinessAssistantPanel dashboard={dashboard} insights={insights} /> : null}
      {activeSection === "records" ? (
        <>
          <BusinessRecordsOverview customers={customers} dashboard={dashboard} scores={scores} />
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
        </>
      ) : null}
    </>
  );
}

function BusinessSummaryMetrics({ summary }: { summary: BusinessSummaryInsight }) {
  return (
    <Panel>
      <SectionTitle title="KOBİ özeti" meta="30 gün" />
      <View style={styles.metricGrid}>
        <MetricCard icon={<Landmark size={18} color={palette.primary} />} label="Kasa" value={shortMoney(summary.cashBalance)} tone="primary" />
        <MetricCard icon={<CircleDollarSign size={18} color={palette.success} />} label="Tahsilat" value={shortMoney(summary.expectedCollections30Days)} tone="success" />
        <MetricCard icon={<Clock3 size={18} color={palette.warn} />} label="Ödeme" value={shortMoney(summary.upcomingPayments30Days)} tone="warn" />
        <MetricCard icon={<AlertTriangle size={18} color={palette.danger} />} label="Geciken" value={shortMoney(summary.overdueReceivables)} tone="danger" />
        <MetricCard icon={<TrendingUp size={18} color={palette.teal} />} label="30 gün sonu" value={shortMoney(summary.projected30Days)} tone="teal" />
        <MetricCard icon={<ShieldAlert size={18} color={palette.primary} />} label="Risk skoru" value={`${summary.cashRiskScore}/100`} tone={riskTone(summary.riskLevel)} />
      </View>
    </Panel>
  );
}

function BusinessTwinPanel({ insights }: { insights: BusinessInsights }) {
  const nextCriticalDate = insights.twin.criticalDates[0];
  return (
    <Panel>
      <SectionTitle title="Finansal ikiz" meta={riskLabel(insights.summary.riskLevel)} />
      <View style={localStyles.businessHeroCopy}>
        <Sparkles size={20} color={palette.primary} />
        <View style={localStyles.alertCopy}>
          <Text style={localStyles.cardTitle}>{insights.twin.summary}</Text>
          <Text style={styles.bodyMuted}>Kayıtlı KOBİ nakit olayları ve müşteri skorlarından deterministik olarak hesaplandı.</Text>
        </View>
      </View>
      <View style={styles.metricGrid}>
        <MiniFact label="Risk skoru" value={`${insights.summary.cashRiskScore}/100`} tone={riskTone(insights.summary.riskLevel)} />
        <MiniFact label="En düşük bakiye" value={money(insights.summary.lowestProjectedBalance30Days)} tone={insights.summary.lowestProjectedBalance30Days < 0 ? "danger" : "success"} />
        <MiniFact label="Kritik gün" value={nextCriticalDate ? formatShortDate(nextCriticalDate.date) : "Görünmüyor"} />
        <MiniFact label="30 gün sonu" value={money(insights.summary.projected30Days)} tone={insights.summary.projected30Days < 0 ? "danger" : "success"} />
      </View>
      {insights.twin.criticalDates.length > 0 ? (
        <View style={localStyles.profileRowList}>
          {insights.twin.criticalDates.slice(0, 4).map((item) => (
            <View style={localStyles.profileRow} key={`${item.date}-${item.label}`}>
              <View style={localStyles.alertIcon}>
                <AlertTriangle size={18} color={toneColor(riskTone(item.riskLevel))} />
              </View>
              <View style={localStyles.alertCopy}>
                <Text style={localStyles.cardTitle}>{formatShortDate(item.date)} · {item.label}</Text>
                <Text style={styles.bodyMuted}>{money(item.projectedBalance)} tahmini bakiye</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <BusinessDecisionRows
        rows={[
          { label: "Sonuç", value: twinResultText(insights) },
          { label: "Varsayımlar", value: insights.assumptions.length ? insights.assumptions.join(" ") : "Kayıtlı nakit olayları ve müşteri verisi değişmeden kaldı." },
          { label: "Eksik veri", value: insights.missingData.length ? insights.missingData.join(" ") : "Kritik eksik veri görünmüyor." },
          { label: "Önerilen aksiyon", value: twinActionText(insights) }
        ]}
      />
    </Panel>
  );
}

function BusinessDnaPanel({ dna }: { dna: BusinessInsights["businessDna"] }) {
  const topFactor = [...dna.factors].sort((left, right) => right.score - left.score)[0];
  return (
    <Panel>
      <SectionTitle title="İşletme DNA" meta={`${dna.overallRisk}/100 risk`} />
      <View style={styles.metricGrid}>
        <MiniFact label="Genel risk" value={`${dna.overallRisk}/100`} tone={riskTone(riskFromScoreValue(dna.overallRisk))} />
        <MiniFact label="Veri güveni" value={dataConfidenceLabel(dna.dataConfidenceLevel)} />
        <MiniFact label="Ana sinyal" value={topFactor?.label ?? "Veri yok"} tone={topFactor ? riskTone(topFactor.riskLevel) : "muted"} />
        <MiniFact label="Eksik veri" value={`${dna.missingData.length}`} />
      </View>
      <View style={localStyles.profileRowList}>
        {dna.patterns.map((pattern) => (
          <View style={localStyles.patternCard} key={pattern}>
            <Text style={styles.body}>{pattern}</Text>
          </View>
        ))}
      </View>
      <View style={localStyles.profileRowList}>
        {dna.factors.map((factor) => (
          <BusinessDnaFactorCard factor={factor} key={factor.id} />
        ))}
      </View>
      <BusinessDecisionRows
        rows={[
          { label: "Veri güveni", value: `${dataConfidenceLabel(dna.dataConfidenceLevel)} (${Math.round(dna.dataConfidence * 100)}%)` },
          { label: "Varsayımlar", value: dna.assumptions.length ? dna.assumptions.join(" ") : "Kayıtlı işletme verisi doğrudan kullanıldı." },
          { label: "Eksik veri", value: dna.missingData.length ? dna.missingData.join(" ") : "DNA için temel nakit ve tahsilat verisi mevcut." },
          { label: "Önerilen aksiyon", value: topFactor?.action ?? "Nakit ve tahsilat kayıtları güncel tutulmalı." }
        ]}
      />
    </Panel>
  );
}

function BusinessDnaFactorCard({ factor }: { factor: BusinessDnaFactor }) {
  return (
    <View style={localStyles.collectionCard}>
      <View style={styles.rowBetween}>
        <View style={localStyles.alertCopy}>
          <Text style={localStyles.cardTitle}>{factor.label}</Text>
          <Text style={styles.bodyMuted}>{factor.value}</Text>
        </View>
        <Mono style={[localStyles.collectionScore, { color: toneColor(riskTone(factor.riskLevel)) }]}>{factor.score}</Mono>
      </View>
      <ProgressBar value={factor.score} tone={riskTone(factor.riskLevel)} />
      {factor.benchmark ? <Text style={styles.bodyMuted}>{factor.benchmark}</Text> : null}
      <Text style={styles.body}>{factor.reasons[0]}</Text>
      <Text style={[styles.bodyMuted, localStyles.profileRowText]}>{factor.action}</Text>
    </View>
  );
}

function BusinessCashflowPanel({ points }: { points: BusinessCashflowPoint[] }) {
  const eventfulPoints = points.filter((point) => point.inflow > 0 || point.outflow > 0 || point.riskLevel === "high" || point.riskLevel === "critical");
  const riskyPoints = points.filter((point) => point.riskLevel === "high" || point.riskLevel === "critical");
  const lowestPoint = lowestCashflowPoint(points);
  const totalInflow = sumNumbers(points.map((point) => point.inflow));
  const totalOutflow = sumNumbers(points.map((point) => point.outflow));
  const endingPoint = points[points.length - 1];
  const bars = cashflowBarHeights(points);
  return (
    <Panel>
      <SectionTitle title="30 günlük nakit akışı" meta={`${points.length} gün`} />
      <View style={styles.metricGrid}>
        <MiniFact label="30 gün sonu" value={money(endingPoint?.balance ?? 0)} tone={(endingPoint?.balance ?? 0) < 0 ? "danger" : "success"} />
        <MiniFact label="En düşük bakiye" value={lowestPoint ? money(lowestPoint.balance) : "Veri yok"} tone={lowestPoint ? riskTone(lowestPoint.riskLevel) : "muted"} />
        <MiniFact label="Toplam giriş" value={money(totalInflow)} tone="success" />
        <MiniFact label="Toplam çıkış" value={money(totalOutflow)} tone="danger" />
      </View>
      <View style={localStyles.sparkline}>
        {bars.map((height, index) => (
          <View key={`${points[index]?.date ?? index}-bar`} style={[localStyles.sparkBar, { height, backgroundColor: points[index] ? toneColor(riskTone(points[index].riskLevel)) : palette.teal }]} />
        ))}
      </View>
      <View style={localStyles.profileRowList}>
        {(eventfulPoints.length ? eventfulPoints : points.slice(0, 4)).slice(0, 8).map((point) => (
          <View style={localStyles.cashflowRow} key={`${point.date}-${point.balance}`}>
            <View style={localStyles.alertCopy}>
              <Text style={localStyles.cardTitle}>{formatShortDate(point.date)} · {point.label}</Text>
              <Text style={styles.bodyMuted}>{point.eventTitles.join(", ") || riskLabel(point.riskLevel)}</Text>
            </View>
            <View style={localStyles.documentAmount}>
              <Mono style={[localStyles.cardTitle, { color: toneColor(riskTone(point.riskLevel)) }]}>{money(point.balance)}</Mono>
              <Text style={styles.bodyMuted}>+{money(point.inflow)} / -{money(point.outflow)}</Text>
            </View>
          </View>
        ))}
      </View>
      <BusinessDecisionRows
        rows={[
          { label: "Sonuç", value: riskyPoints.length ? `${riskyPoints.length} riskli gün görünüyor.` : "Kayda göre yüksek riskli gün görünmüyor." },
          { label: "Neden", value: `Toplam giriş ${money(totalInflow)}, toplam çıkış ${money(totalOutflow)}.` },
          { label: "Varsayımlar", value: "Kayıtlı tahsilat ve ödeme tarihleri değişmeden kaldı." },
          { label: "Veri güveni", value: points.length > 0 ? "Orta - nakit olaylarının tarih doğruluğuna bağlı." : "Düşük - nakit olay kaydı bekleniyor." },
          { label: "Önerilen aksiyon", value: riskyPoints.length ? "Riskli günlerden önce tahsilat teyidi veya ödeme erteleme alternatifi kontrol edilmeli." : "Yeni ödeme/tahsilat girildikçe akış yeniden izlenmeli." }
        ]}
      />
    </Panel>
  );
}

function BusinessCoveragePanel({ coverage }: { coverage: BusinessCoverageAnalysis }) {
  return (
    <Panel>
      <SectionTitle title="Maaş ve kira" meta={coverage.comfortLevel === "missing_data" ? "veri bekleniyor" : coverage.canCover ? "karşılanabilir" : "riskli"} />
      <View style={localStyles.businessHeroCopy}>
        {coverage.canCover ? <CheckCircle2 size={20} color={palette.success} /> : <AlertTriangle size={20} color={palette.danger} />}
        <Text style={[styles.body, localStyles.profileRowText]}>{coverage.explanation}</Text>
      </View>
      <View style={styles.metricGrid}>
        <MiniFact label="Maaş" value={money(coverage.payrollTotal)} />
        <MiniFact label="Kira" value={money(coverage.rentTotal)} />
        <MiniFact label="Gerekli toplam" value={money(coverage.requiredTotal)} />
        <MiniFact label="Tampon açığı" value={money(coverage.shortfall)} tone={coverage.shortfall > 0 ? "danger" : "success"} />
      </View>
      {coverage.riskDate ? <Text style={styles.bodyMuted}>Risk tarihi: {formatShortDate(coverage.riskDate)}</Text> : null}
      {coverage.relievingCollection ? <Text style={styles.bodyMuted}>{coverage.relievingCollection.title} tahsilatı gelirse tampon güçlenir.</Text> : null}
      {coverage.deferrablePayment ? <Text style={styles.bodyMuted}>{coverage.deferrablePayment.title} ertelenirse risk azalır.</Text> : null}
      <BusinessDecisionRows
        rows={[
          { label: "Sonuç", value: coverageDecisionResult(coverage) },
          { label: "Neden", value: coverage.explanation },
          { label: "Varsayımlar", value: "Yalnızca kayıtlı ve maaş/kira olarak etiketlenmiş ödeme olayları dikkate alındı." },
          { label: "Veri güveni", value: coverage.comfortLevel === "missing_data" ? "Düşük - maaş/kira etiketi yok." : "Orta - kayıtlı nakit olaylarına bağlı." },
          { label: "Önerilen aksiyon", value: coverageActionText(coverage) }
        ]}
      />
    </Panel>
  );
}

function BusinessCollectionPriorityPanel({ priorities }: { priorities: CollectionPriority[] }) {
  const totalOutstanding = sumNumbers(priorities.map((priority) => priority.outstandingAmount));
  const highRiskCount = priorities.filter((priority) => priority.riskLevel === "high" || priority.riskLevel === "critical").length;
  const averageScore = priorities.length ? Math.round(sumNumbers(priorities.map((priority) => priority.score)) / priorities.length) : 0;
  return (
    <Panel>
      <SectionTitle title="Tahsilat önceliği" meta={`${priorities.length} müşteri`} />
      <View style={styles.metricGrid}>
        <MiniFact label="Açık bakiye" value={money(totalOutstanding)} tone="danger" />
        <MiniFact label="Yüksek risk" value={`${highRiskCount}`} tone={highRiskCount > 0 ? "danger" : "success"} />
        <MiniFact label="Ortalama skor" value={priorities.length ? `${averageScore}/100` : "Veri yok"} />
        <MiniFact label="Plan" value={priorities[0]?.customerName ?? "Bekleniyor"} />
      </View>
      {priorities.length > 0 ? (
        <View style={localStyles.profileRowList}>
          {priorities.slice(0, 6).map((priority, index) => (
            <View style={localStyles.collectionCard} key={priority.customerId}>
              <View style={styles.rowBetween}>
                <View style={localStyles.alertCopy}>
                  <Text style={localStyles.cardTitle}>{index + 1}. {priority.customerName}</Text>
                  <Text style={styles.bodyMuted}>{priority.averageDelayDays} gün gecikme · {riskLabel(priority.riskLevel)}</Text>
                </View>
                <Mono style={[localStyles.scenarioAmount, { color: toneColor(riskTone(priority.riskLevel)) }]}>{money(priority.outstandingAmount)}</Mono>
              </View>
              <ProgressBar value={priority.score} tone={riskTone(priority.riskLevel)} />
              <Text style={styles.body}>{priority.action}</Text>
              <View style={localStyles.businessHeroCopy}>
                <MessageSquareText size={16} color={palette.primary} />
                <Text style={[styles.bodyMuted, localStyles.profileRowText]}>{priority.reminderMessage}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyPanelMessage message="Önceliklendirme için müşteri ve açık bakiye bekleniyor." />
      )}
      <BusinessDecisionRows
        rows={[
          { label: "Sonuç", value: priorities[0] ? `${priorities[0].customerName} ilk tahsilat odağı olmalı.` : "Önceliklendirilecek tahsilat görünmüyor." },
          { label: "Neden", value: priorities[0] ? `${money(priorities[0].outstandingAmount)} açık bakiye ve ${riskLabel(priorities[0].riskLevel)} risk sinyali var.` : "Kayıtlı müşteri açık bakiye/gecikme verisi acil sinyal üretmedi." },
          { label: "Varsayımlar", value: "Müşteri skoru, açık bakiye ve ortalama gecikme günleri birlikte değerlendirildi." },
          { label: "Veri güveni", value: priorities.length ? "Orta - müşteri ödeme geçmişi kayıtlarına bağlı." : "Düşük - müşteri/tahsilat kaydı bekleniyor." },
          { label: "Önerilen aksiyon", value: priorities[0]?.action ?? "Yeni fatura ve müşteri gecikme verileri girildikçe öncelik yeniden hesaplanmalı." }
        ]}
      />
    </Panel>
  );
}

function BusinessScenarioPanel({ business, dashboard, scenarios }: { business: Business; dashboard: BusinessDashboard; scenarios: BusinessScenarioAnalysis[] }) {
  const [selectedScenarioId, setSelectedScenarioId] = useState<BusinessScenarioAnalysis["id"]>(scenarios[0]?.id ?? "collection_delay");
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0];
  const bestScenario = [...scenarios].sort((left, right) => right.cashImpact - left.cashImpact)[0];
  const worstScenario = [...scenarios].sort((left, right) => left.cashImpact - right.cashImpact)[0];
  return (
    <>
      <Panel>
        <SectionTitle title="What-if senaryoları" meta={`${scenarios.length} hazır`} />
        <View style={styles.metricGrid}>
          <MiniFact label="En güçlü etki" value={bestScenario ? signedMoney(bestScenario.cashImpact) : "Veri yok"} tone={bestScenario && bestScenario.cashImpact >= 0 ? "success" : "danger"} />
          <MiniFact label="En zayıf etki" value={worstScenario ? signedMoney(worstScenario.cashImpact) : "Veri yok"} tone={worstScenario && worstScenario.cashImpact < 0 ? "danger" : "success"} />
          <MiniFact label="Seçili risk" value={selectedScenario ? riskLabel(selectedScenario.riskLevel) : "Veri yok"} tone={selectedScenario ? riskTone(selectedScenario.riskLevel) : "muted"} />
          <MiniFact label="30 gün" value={selectedScenario ? money(selectedScenario.projected30Days) : "Veri yok"} />
        </View>
        <View style={localStyles.segmentedWrap}>
          {scenarios.map((scenario) => (
            <Pressable key={scenario.id} onPress={() => setSelectedScenarioId(scenario.id)} style={[localStyles.segmentButton, localStyles.segmentWrapButton, selectedScenario?.id === scenario.id && localStyles.segmentButtonActive]}>
              <Text style={[localStyles.segmentButtonText, selectedScenario?.id === scenario.id && localStyles.segmentButtonTextActive]}>{scenario.label}</Text>
            </Pressable>
          ))}
        </View>
        {selectedScenario ? (
          <View style={[localStyles.scenarioCard, selectedScenario.riskLevel === "high" || selectedScenario.riskLevel === "critical" ? localStyles.scenarioSelected : null]}>
            <View style={styles.rowBetween}>
              <ArrowRightLeft size={20} color={toneColor(riskTone(selectedScenario.riskLevel))} />
              <Mono style={[localStyles.scenarioAmount, { color: toneColor(riskTone(selectedScenario.riskLevel)) }]}>{signedMoney(selectedScenario.cashImpact)}</Mono>
            </View>
            <Text style={localStyles.cardTitle}>{money(selectedScenario.projected30Days)} 30 gün sonu tahmini kasa</Text>
            <Text style={styles.bodyMuted}>{selectedScenario.description}</Text>
            <Text style={styles.body}>{selectedScenario.recommendation}</Text>
          </View>
        ) : (
          <EmptyPanelMessage message="Senaryo için nakit verisi bekleniyor." />
        )}
        {selectedScenario ? (
          <BusinessDecisionRows
            rows={[
              { label: "Sonuç", value: `30 gün sonu tahmini kasa ${money(selectedScenario.projected30Days)}.` },
              { label: "Neden", value: selectedScenario.description },
              { label: "Varsayımlar", value: scenarioAssumptionText(selectedScenario) },
              { label: "Veri güveni", value: scenarioConfidenceText(selectedScenario) },
              { label: "Önerilen aksiyon", value: selectedScenario.recommendation }
            ]}
          />
        ) : null}
      </Panel>
      <AiCfoSimulationPanel business={business} dashboard={dashboard} />
    </>
  );
}

type BusinessAssistantPromptId = "coverage" | "risk" | "collections" | "critical";

const businessAssistantPrompts: Array<{ id: BusinessAssistantPromptId; label: string }> = [
  { id: "coverage", label: "Maaş ve kirayı karşılayabilir miyim?" },
  { id: "risk", label: "Nakit sıkışıklığı yaşayacak mıyım?" },
  { id: "collections", label: "Hangi tahsilat daha kritik?" },
  { id: "critical", label: "Önümüzdeki kritik günler neler?" }
];

function BusinessAssistantPanel({ dashboard, insights }: { dashboard: BusinessDashboard; insights: BusinessInsights }) {
  const [selectedPrompt, setSelectedPrompt] = useState<BusinessAssistantPromptId>("coverage");
  const [question, setQuestion] = useState("");
  const [customQuestion, setCustomQuestion] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<BusinessAssistantPromptId | null>(null);
  const activePrompt = customPrompt ?? selectedPrompt;
  const answer = businessAssistantAnswer(activePrompt, dashboard, insights, customQuestion ?? undefined);
  const activeQuestionLabel = customQuestion ?? businessAssistantPrompts.find((prompt) => prompt.id === selectedPrompt)?.label ?? "KOBİ sorusu";
  const criticalDate = insights.twin.criticalDates[0];

  function selectPrompt(prompt: BusinessAssistantPromptId) {
    setSelectedPrompt(prompt);
    setCustomPrompt(null);
    setCustomQuestion(null);
  }

  function submitQuestion() {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setCustomQuestion(trimmedQuestion);
    setCustomPrompt(inferBusinessAssistantPrompt(trimmedQuestion));
    setQuestion("");
  }

  return (
    <Panel>
      <SectionTitle title="KOBİ asistanı" meta="karar destek" />
      <View style={styles.metricGrid}>
        <MiniFact label="Risk skoru" value={`${insights.summary.cashRiskScore}/100`} tone={riskTone(insights.summary.riskLevel)} />
        <MiniFact label="30 gün sonu" value={money(insights.summary.projected30Days)} tone={insights.summary.projected30Days < 0 ? "danger" : "success"} />
        <MiniFact label="Tahsilat" value={money(insights.summary.expectedCollections30Days)} tone="success" />
        <MiniFact label="Kritik gün" value={criticalDate ? formatShortDate(criticalDate.date) : "Görünmüyor"} />
      </View>
      <View style={localStyles.segmentedWrap}>
        {businessAssistantPrompts.map((prompt) => (
          <Pressable key={prompt.id} onPress={() => selectPrompt(prompt.id)} style={[localStyles.segmentButton, localStyles.segmentWrapButton, !customPrompt && selectedPrompt === prompt.id && localStyles.segmentButtonActive]}>
            <Text style={[localStyles.segmentButtonText, !customPrompt && selectedPrompt === prompt.id && localStyles.segmentButtonTextActive]}>{prompt.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={localStyles.agentInputShell}>
        <TextInput value={question} onChangeText={setQuestion} placeholder="Nakit sıkışır mı?" placeholderTextColor={palette.muted} style={[localStyles.authInput, localStyles.profileRowText]} onSubmitEditing={submitQuestion} />
        <IconButton onPress={submitQuestion} tone="primary">
          <MessageSquareText size={18} color={palette.primary} />
        </IconButton>
      </View>
      <View style={localStyles.collectionCard}>
        <View style={localStyles.businessHeroCopy}>
          <Bot size={20} color={palette.primary} />
          <View style={localStyles.alertCopy}>
            <Text style={styles.bodyMuted}>{activeQuestionLabel}</Text>
            <Text style={localStyles.cardTitle}>{answer.result}</Text>
          </View>
        </View>
        <BusinessDecisionRows
          rows={[
            { label: "Sonuç", value: answer.result },
            { label: "Neden", value: answer.reason },
            { label: "Soru odağı", value: answer.focus },
            { label: "Varsayımlar", value: answer.assumptions },
            { label: "Veri güveni", value: answer.confidence },
            ...(answer.missingData ? [{ label: "Eksik veri", value: answer.missingData }] : []),
            { label: "Önerilen aksiyon", value: answer.action }
          ]}
        />
      </View>
    </Panel>
  );
}

function BusinessRecordsOverview({ customers, dashboard, scores }: { customers: BusinessCustomer[]; dashboard: BusinessDashboard; scores: CollectionScore[] }) {
  const totalCollections = sumNumbers(dashboard.expectedCollections.map((event) => event.amount));
  const totalPayments = sumNumbers(dashboard.upcomingPayments.map((event) => event.amount));
  const totalOutstanding = sumNumbers(customers.map((customer) => customer.outstandingAmount));
  const lateCustomerCount = customers.filter((customer) => customer.invoicesLate > 0).length;
  const averageScore = scores.length > 0 ? Math.round(sumNumbers(scores.map((score) => score.score)) / scores.length) : 0;
  return (
    <Panel>
      <SectionTitle title="Veri kalitesi" meta="analiz kaynağı" />
      <Text style={styles.bodyMuted}>Nakit olayları ve müşteri kayıtları bu moddaki analizlerin deterministik veri kaynağıdır.</Text>
      <View style={styles.metricGrid}>
        <MiniFact label="Nakit olayı" value={`${dashboard.expectedCollections.length + dashboard.upcomingPayments.length}`} />
        <MiniFact label="Beklenen tahsilat" value={money(totalCollections)} tone="success" />
        <MiniFact label="Yaklaşan ödeme" value={money(totalPayments)} tone="danger" />
        <MiniFact label="Tahsilat skoru" value={scores.length ? `${averageScore}/100` : "Veri yok"} />
        <MiniFact label="Müşteri" value={`${customers.length}`} />
        <MiniFact label="Geciken müşteri" value={`${lateCustomerCount}`} tone={lateCustomerCount > 0 ? "warn" : "success"} />
      </View>
      <BusinessDecisionRows
        rows={[
          { label: "Nakit veri", value: `${dashboard.expectedCollections.length} tahsilat · ${dashboard.upcomingPayments.length} ödeme · açık bakiye ${money(totalOutstanding)}.` },
          { label: "Önerilen aksiyon", value: "Eksik tahsilat, ödeme ve müşteri gecikme kayıtları tamamlandıkça diğer KOBİ panellerinin güveni artar." }
        ]}
      />
    </Panel>
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
  const [decision, setDecision] = useState("Yeni yatırım kararı");
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
    if (!decision.trim()) {
      setError("Karar açıklaması gerekli.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      setResult(await simulateBusinessDecision(business.id, { amount: parsedAmount, decision: decision.trim() }));
    } catch (simulateError) {
      setError(simulateError instanceof Error ? simulateError.message : "Simülasyon çalıştırılamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel>
      <SectionTitle title="Kararı simüle et" meta="ikiz CFO önerisi" />
      <TextInput value={decision} onChangeText={setDecision} placeholder="Espresso makinesi alımı" placeholderTextColor={palette.muted} style={localStyles.authInput} />
      <View style={localStyles.simInput}>
        <Text style={styles.bodyMuted}>Yeni yatırım tutarı:</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={localStyles.simAmountInput} />
      </View>
      <View style={styles.metricGrid}>
        <MiniFact label="30 gün sonrası" value={money(dashboard.projected30Days - previewAmount)} />
        <MiniFact label="Likidite" value={result ? riskLabel(result.riskLevel) : riskLabel(dashboard.liquidityRisk)} />
      </View>
      {result ? (
        <>
          <Text style={styles.body}>İkiz CFO: {result.summary} {result.recommendedPlan}</Text>
          <BusinessDecisionRows
            rows={[
              { label: "Sonuç", value: result.summary },
              { label: "Neden", value: result.reason },
              { label: "Varsayımlar", value: simulationAssumptionText(result) },
              { label: "Veri güveni", value: simulationConfidenceText(result) },
              ...(result.missingData.length ? [{ label: "Eksik veri", value: result.missingData.join(" ") }] : []),
              { label: "Önerilen aksiyon", value: result.recommendedPlan }
            ]}
          />
        </>
      ) : null}
      {error ? <Text style={localStyles.authError}>{error}</Text> : null}
      <Button label={pending ? "Hesaplanıyor" : "Simülasyonu çalıştır"} icon={<FileScan size={15} color={palette.surface} />} onPress={() => void runSimulation()} disabled={pending} />
    </Panel>
  );
}

function MiniFact({ label, tone, value }: { label: string; tone?: "primary" | "teal" | "warn" | "danger" | "success" | "muted"; value: string }) {
  return (
    <View style={localStyles.miniFact}>
      <Text style={localStyles.miniLabel}>{label}</Text>
      <Mono style={[localStyles.miniValue, tone ? { color: toneColor(tone) } : null]}>{value}</Mono>
    </View>
  );
}

function BusinessDecisionRows({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <View style={localStyles.businessDecisionRows}>
      {rows.map((row) => (
        <View style={localStyles.businessDecisionRow} key={`${row.label}-${row.value}`}>
          <Text style={localStyles.miniLabel}>{row.label}</Text>
          <Text style={[styles.body, localStyles.profileRowText]}>{row.value}</Text>
        </View>
      ))}
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

function moneyWithCurrency(value: number, currency: Currency) {
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${currency}`;
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function goalAmount(goal: Goal | undefined) {
  return goal ? String(goal.targetAmount) : "";
}

function displayAmount(value: string) {
  return parseDecimalInput(value) ?? 0;
}

function isSavingsGoal(goal: Goal) {
  return goal.title === "Aylık birikim hedefi" || goal.title === "Yıllık birikim hedefi";
}

function mergeGoals(current: Goal[], next: Goal[]) {
  return [...next, ...current.filter((goal) => !next.some((item) => item.id === goal.id))].sort((left, right) => left.deadline.localeCompare(right.deadline));
}

function budgetInputMap(planning: PlanningOverview) {
  return Object.fromEntries(planning.budgets.map((budget) => [budget.categoryId, String(budget.monthlyLimit)]));
}

function budgetCaption(planning: PlanningOverview, categoryId: string) {
  const budget = planning.budgets.find((item) => item.categoryId === categoryId);
  return budget ? `Mevcut limit: ${money(budget.monthlyLimit)}` : "Henüz limit yok";
}

function categoryLabel(categories: Category[], categoryId: string) {
  return categories.find((category) => category.id === categoryId)?.name ?? categoryId;
}

function accountTypeLabel(type: Account["type"]) {
  return accountTypeOptions.find((item) => item.value === type)?.label ?? type;
}

function documentTitle(document: DocumentHistoryItem) {
  return document.fileName ?? document.merchant ?? document.statementMonth ?? "Belge";
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

function transactionDateKey(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function paymentMethodLabel(method: Transaction["paymentMethod"]) {
  if (method === "cash") return "Nakit";
  if (method === "debit_card") return "Banka kartı";
  if (method === "credit_card") return "Kredi kartı";
  return "Transfer";
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

function sumNumbers(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function lowestCashflowPoint(points: BusinessCashflowPoint[]) {
  return points.reduce<BusinessCashflowPoint | undefined>((lowest, point) => {
    if (!lowest || point.balance < lowest.balance) return point;
    return lowest;
  }, undefined);
}

function cashflowBarHeights(points: BusinessCashflowPoint[]) {
  if (!points.length) return [];
  const balances = points.map((point) => point.balance);
  const min = Math.min(0, ...balances);
  const max = Math.max(1, ...balances);
  const spread = Math.max(max - min, 1);
  return points.map((point) => 12 + Math.round(((point.balance - min) / spread) * 70));
}

function twinResultText(insights: BusinessInsights) {
  if (insights.summary.riskLevel === "high" || insights.summary.riskLevel === "critical") {
    return `Nakit risk seviyesi ${riskLabel(insights.summary.riskLevel)}; en düşük tahmini bakiye ${money(insights.summary.lowestProjectedBalance30Days)}.`;
  }
  return `Kayıtlı verilere göre 30 gün sonu tahmini kasa ${money(insights.summary.projected30Days)}.`;
}

function twinActionText(insights: BusinessInsights) {
  if (insights.missingData.length > 0) return "Eksik veri alanları tamamlanırsa finansal ikiz daha güvenilir uyarı üretir.";
  if (insights.collectionPriorities.length > 0 && insights.summary.overdueReceivables > 0) {
    return `${insights.collectionPriorities[0].customerName} tahsilatı önceliklendirilirse kısa vadeli nakit tamponu güçlenir.`;
  }
  if (insights.coverage.deferrablePayment) return `${insights.coverage.deferrablePayment.title} ödeme tarihi ayrıca değerlendirilebilir.`;
  return "Mevcut projeksiyonu korumak için kayıtlı tahsilat ve ödeme tarihleri düzenli güncellenmeli.";
}

function coverageDecisionResult(coverage: BusinessCoverageAnalysis) {
  if (coverage.comfortLevel === "missing_data") return "Maaş veya kira etiketi olmadığı için analiz tamamlanamadı.";
  if (coverage.canCover && coverage.shortfall === 0) return "Maaş ve kira ödemeleri güvenli tampon korunarak karşılanabiliyor.";
  if (coverage.canCover) return "Ödemeler karşılanıyor ancak güvenli tampon zayıflıyor.";
  return "Ödeme döneminde nakit açığı riski oluşuyor.";
}

function coverageActionText(coverage: BusinessCoverageAnalysis) {
  if (coverage.comfortLevel === "missing_data") return "Maaş ve kira ödeme kayıtlarını etiketleyerek yeniden hesaplama yapılmalı.";
  if (coverage.relievingCollection) return `${coverage.relievingCollection.title} tahsilatı takip edilirse tampon açığı azalır.`;
  if (coverage.deferrablePayment) return `${coverage.deferrablePayment.title} için erteleme etkisi ayrıca değerlendirilebilir.`;
  return "Kritik ödeme haftasından önce güncel tahsilat ve ödeme kayıtları kontrol edilmeli.";
}

function scenarioAssumptionText(scenario: BusinessScenarioAnalysis) {
  return `${scenario.label} varsayımı uygulandı; veri setindeki diğer nakit olayları aynı kaldı. Para birimi TRY olarak gösterildi.`;
}

function scenarioConfidenceText(scenario: BusinessScenarioAnalysis) {
  return scenario.description.includes("bulunmadı") ? "Düşük - ilgili nakit olayı bulunamadı." : "Orta - kayıtlı nakit olayları üzerinden hesaplandı.";
}

function simulationAssumptionText(simulation: AiCfoSimulation) {
  return simulation.assumptions.length ? simulation.assumptions.join(" ") : "Kayıtlı KOBİ nakit olayları üzerinden hesaplandı.";
}

function simulationConfidenceText(simulation: AiCfoSimulation) {
  return `${dataConfidenceLabel(simulation.dataConfidenceLevel)} (${Math.round(simulation.dataConfidence * 100)}%) - ${riskLabel(simulation.riskLevel)} risk.`;
}

function riskFromScoreValue(score: number) {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function dataConfidenceLabel(confidence: BusinessInsights["businessDna"]["dataConfidenceLevel"]) {
  return {
    high: "Yüksek",
    medium: "Orta",
    low: "Düşük"
  }[confidence];
}

type BusinessAssistantAnswer = {
  action: string;
  assumptions: string;
  confidence: string;
  focus: string;
  missingData?: string;
  reason: string;
  result: string;
};

function inferBusinessAssistantPrompt(question: string): BusinessAssistantPromptId {
  const normalized = question.toLocaleLowerCase("tr-TR");
  if (includesAny(normalized, ["tahsil", "müşteri", "musteri", "fatura", "alacak", "vade", "gecik"])) return "collections";
  if (includesAny(normalized, ["maaş", "maas", "kira", "zorunlu", "ödeyebilir", "odeyebilir", "karşıla", "karsila"])) return "coverage";
  if (includesAny(normalized, ["kritik", "tarih", "gün", "gun", "ne zaman", "deadline", "takvim"])) return "critical";
  return "risk";
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function businessAssistantAnswer(prompt: BusinessAssistantPromptId, dashboard: BusinessDashboard, insights: BusinessInsights, question?: string): BusinessAssistantAnswer {
  const parsedAmount = question ? parseAmountFromText(question) : undefined;
  const questionAmount = parsedAmount?.value && parsedAmount.confidence >= 0.45 ? parsedAmount.value : undefined;
  const focus = businessAssistantFocusText(prompt, questionAmount);
  const missingData = insights.missingData.length > 0 ? insights.missingData.join(" ") : undefined;

  if (prompt === "risk" && questionAmount) {
    const projectedAfterDecision = dashboard.projected30Days - questionAmount;
    const decisionRiskLevel = cashProjectionRiskLevel(projectedAfterDecision);
    return {
      result: `${money(questionAmount)} kararından sonra 30 gün sonu tahmini kasa ${money(projectedAfterDecision)} olur.`,
      reason: "Serbest sorudaki tutar, kayıtlı 30 günlük KOBİ kasa projeksiyonundan tek seferlik nakit çıkışı olarak düşüldü.",
      focus,
      assumptions: "Karar tutarı tek seferlik çıkış kabul edildi; kayıtlı tahsilat ve ödeme tarihleri değişmeden kaldı. Para birimi TRY olarak gösterildi.",
      confidence: dashboard.upcomingPayments.length + dashboard.expectedCollections.length > 0 ? `Orta - nakit olaylarına bağlı; karar sonrası risk ${riskLabel(decisionRiskLevel)}.` : `Düşük - nakit olayı sınırlı; karar sonrası risk ${riskLabel(decisionRiskLevel)}.`,
      missingData,
      action:
        decisionRiskLevel === "critical" || decisionRiskLevel === "high"
          ? "Kararı fazlara bölmeden önce tahsilat teyidi ve ödeme erteleme alternatifi kontrol edilmeli."
          : "Tutarı Senaryolar bölümündeki özel simülasyonla da kaydedip nakit etkisi izlenmeli."
    };
  }

  if (prompt === "coverage") {
    return {
      result: coverageDecisionResult(insights.coverage),
      reason: insights.coverage.explanation,
      focus,
      assumptions: "Yalnızca kayıtlı maaş ve kira ödeme olayları ile beklenen tahsilatlar dikkate alındı.",
      confidence: insights.coverage.comfortLevel === "missing_data" ? "Düşük - maaş/kira etiketi eksik." : "Orta - kayıtlı KOBİ nakit olaylarına bağlı.",
      missingData,
      action: coverageActionText(insights.coverage)
    };
  }

  if (prompt === "collections") {
    const priority = insights.collectionPriorities[0];
    if (!priority) {
      return {
        result: "Önceliklendirilecek geciken tahsilat görünmüyor.",
        reason: "Müşteri açık bakiye ve gecikme verilerinde acil tahsilat sinyali oluşmadı.",
        focus,
        assumptions: "Kayıtlı müşteri skorları ve açık bakiye alanları kullanıldı.",
        confidence: dashboard.expectedCollections.length > 0 ? "Orta - tahsilat kayıtları var." : "Düşük - tahsilat kaydı sınırlı.",
        missingData,
        action: "Yeni fatura ve müşteri gecikme verileri girildikçe tahsilat önceliği yeniden hesaplanmalı."
      };
    }
    return {
      result: `${priority.customerName} ilk tahsilat odağı olmalı.`,
      reason: `${money(priority.outstandingAmount)} açık bakiye, ${priority.averageDelayDays} gün ortalama gecikme ve ${riskLabel(priority.riskLevel)} risk sinyali var.`,
      focus,
      assumptions: "Müşteri skoru, açık bakiye ve ortalama gecikme günleri birlikte değerlendirildi.",
      confidence: "Orta - müşteri ödeme geçmişi kayıtlarına bağlı.",
      missingData,
      action: priority.action
    };
  }

  if (prompt === "critical") {
    const criticalDates = insights.twin.criticalDates.slice(0, 3);
    if (criticalDates.length === 0) {
      return {
        result: "Önümüzdeki 30 gün için kritik gün görünmüyor.",
        reason: `Kayıtlı nakit akışı 30 gün sonunda ${money(insights.summary.projected30Days)} projeksiyon üretiyor.`,
        focus,
        assumptions: "Kayıtlı tahsilat ve ödeme tarihleri değişmeden kaldı.",
        confidence: dashboard.upcomingPayments.length + dashboard.expectedCollections.length > 0 ? "Orta - nakit olaylarına bağlı." : "Düşük - nakit olayı az.",
        missingData,
        action: "Yeni ödeme veya tahsilat eklendiğinde kritik günler yeniden kontrol edilmeli."
      };
    }
    return {
      result: `${criticalDates.length} kritik gün öne çıkıyor.`,
      reason: criticalDates.map((date) => `${formatShortDate(date.date)}: ${money(date.projectedBalance)} (${riskLabel(date.riskLevel)})`).join(", "),
      focus,
      assumptions: "Kritik günler günlük tahmini nakit bakiyesi üzerinden seçildi.",
      confidence: "Orta - kayıtlı nakit akışı tarih doğruluğuna bağlı.",
      missingData,
      action: "Bu tarihlerden önce tahsilat teyidi veya ödeme erteleme planı hazırlanmalı."
    };
  }

  return {
    result: `Nakit risk skoru ${insights.summary.cashRiskScore}/100 ve seviye ${riskLabel(insights.summary.riskLevel)}.`,
    reason: `30 gün sonu kasa ${money(insights.summary.projected30Days)}, en düşük tahmini bakiye ${money(insights.summary.lowestProjectedBalance30Days)}.`,
    focus,
    assumptions: "Kayıtlı KOBİ kasa, beklenen tahsilat, yaklaşan ödeme ve müşteri gecikme verileri kullanıldı.",
    confidence: dashboard.upcomingPayments.length + dashboard.expectedCollections.length > 0 ? "Orta - nakit olayları mevcut." : "Düşük - kayıtlı nakit olayı sınırlı.",
    missingData,
    action: twinActionText(insights)
  };
}

function businessAssistantFocusText(prompt: BusinessAssistantPromptId, amount?: number) {
  const label = {
    coverage: "Maaş/kira karşılanabilirliği",
    risk: "Nakit riski",
    collections: "Tahsilat önceliği",
    critical: "Kritik günler"
  }[prompt];
  return amount ? `${label}; serbest sorudaki tutar: ${money(amount)}.` : label;
}

function cashProjectionRiskLevel(balance: number) {
  if (balance < 0) return "critical";
  if (balance < 50000) return "high";
  if (balance < 100000) return "medium";
  return "low";
}

function leakIssueLabel(issue: SubscriptionLeak["issue"]) {
  return {
    unused: "Kullanılmıyor",
    duplicate: "Mükerrer",
    small_leak: "Yeni",
    price_increase: "Fiyat artışı"
  }[issue];
}

function subscriptionStatusLabel(status: SubscriptionStatus) {
  return {
    active: "Aktif",
    watching: "İzleniyor",
    cancelled: "İptal",
    ignored: "Yok sayıldı"
  }[status];
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
  accountTypeGroup: {
    gap: 8
  },
  accountTypeGrid: {
    flexDirection: "row",
    gap: 8
  },
  accountTypeButton: {
    flex: 1,
    minHeight: 76,
    borderWidth: 1,
    borderColor: "rgba(16,24,21,0.1)",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.62)",
    padding: 12,
    gap: 4
  },
  accountTypeButtonActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft
  },
  accountTypeTextActive: {
    color: palette.primary
  },
  accountTypeCaptionActive: {
    color: palette.primary
  },
  authSeparator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4
  },
  authSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(16,24,21,0.12)"
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
  categoryRiskCard: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.46)"
  },
  commentaryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    backgroundColor: palette.primarySoft
  },
  categoryRow: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.48)"
  },
  categoryRowActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft
  },
  categoryRowCta: {
    color: palette.primary,
    fontFamily: typefaces.body,
    fontSize: 12,
    fontWeight: "800"
  },
  categoryDrawer: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.62)"
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
  profileRowList: {
    gap: 8
  },
  profileRow: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.46)",
    flexDirection: "row",
    alignItems: "center"
  },
  profileRowText: {
    flex: 1
  },
  budgetLimitRow: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.46)",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap"
  },
  budgetLimitInput: {
    flexBasis: 104,
    flexGrow: 1,
    minHeight: 44
  },
  budgetLimitButton: {
    minHeight: 44,
    flexBasis: 92,
    flexGrow: 1
  },
  documentHistoryRow: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.46)",
    flexDirection: "row",
    alignItems: "flex-start"
  },
  documentAmount: {
    minWidth: 84,
    alignItems: "flex-end",
    gap: 3
  },
  documentDetailPanel: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.52)"
  },
  documentStatusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  documentStatusItem: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
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
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderColor: palette.danger,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
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
  businessHeroCopy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  cashflowRow: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.46)",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  businessDecisionRows: {
    gap: 8
  },
  businessDecisionRow: {
    borderColor: "rgba(16,24,21,0.08)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 5,
    backgroundColor: "rgba(16,24,21,0.035)"
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
