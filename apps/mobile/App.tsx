import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Modal, PanResponder, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import Tts from "react-native-tts";
import {
  AlertTriangle,
  BellRing,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileScan,
  FileUp,
  Fingerprint,
  Landmark,
  LogOut,
  Mic2,
  PauseCircle,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  Target,
  ReceiptText,
  UserPlus,
  WalletCards,
  X
} from "lucide-react-native";
import type {
  ActionItem,
  AgentResponse,
  AiCfoSimulation,
  Business,
  BusinessCustomer,
  BusinessDashboard,
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
  importTransactionsCsv,
  loadBusiness,
  loadMobileHome,
  loadStoredAuthToken,
  login,
  persistAuthToken,
  register,
  saveFcmToken,
  sendAgentMessage,
  simulateBusinessDecision,
  type AuthUserProfile
} from "./src/api";
import { PortfolioScreen } from "./src/screens/PortfolioScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { Badge, BottomTabButton, Button, Gauge as ScoreGauge, IconButton, MetricCard, Mono, Panel, ProgressBar, RiskBar, ScreenHeader, SectionTitle, palette, styles } from "./src/ui";

type Tab = "home" | "portfolio" | "agent" | "scan" | "business";
type HomeData = Awaited<ReturnType<typeof loadMobileHome>>;
type BusinessData = NonNullable<Awaited<ReturnType<typeof loadBusiness>>>;

const defaultQuestion = "Bugün 10.000 ₺ teknoloji harcaması yaparsam ne olur?";
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

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => hasAuthToken());
  const [tab, setTab] = useState<Tab>("home");
  const [home, setHome] = useState<HomeData | null>(null);
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
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
    setTab("home");
  }

  function refreshData() {
    setRefreshTick((value) => value + 1);
  }

  if (!authenticated) {
    return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === "home" &&
          (home ? (
            <HomeScreen
              {...home}
              activePeriod={period}
              onPeriodChange={setPeriod}
              onOpenPortfolio={() => setTab("portfolio")}
              onOpenBusiness={() => setTab("business")}
              onLogout={logout}
              onRefresh={refreshData}
            />
          ) : loadError ? (
            <LoadError message={loadError} />
          ) : (
            <Loading />
          ))}
        {tab === "portfolio" && <PortfolioScreen />}
        {tab === "agent" && <AgentScreen />}
        {tab === "scan" && <ScanScreen onImported={refreshData} />}
        {tab === "business" &&
          (business ? (
            <BusinessScreen {...business} onChanged={refreshData} />
          ) : loadError ? (
            <LoadError message={loadError} />
          ) : (
            <BusinessOnboardingScreen onCreated={refreshData} />
          ))}
      </ScrollView>
      <View style={styles.tabBar}>
        <BottomTabButton
          label="Kişisel"
          active={tab === "home"}
          onPress={() => setTab("home")}
          icon={<WalletCards size={20} color={tab === "home" ? palette.secondary : palette.darkMuted} />}
        />
        <BottomTabButton
          label="Portföy"
          active={tab === "portfolio"}
          onPress={() => setTab("portfolio")}
          icon={<Landmark size={20} color={tab === "portfolio" ? palette.secondary : palette.darkMuted} />}
        />
        <BottomTabButton
          label="Agent"
          active={tab === "agent"}
          onPress={() => setTab("agent")}
          icon={<Bot size={20} color={tab === "agent" ? palette.secondary : palette.darkMuted} />}
        />
        <BottomTabButton
          label="Belgeler"
          active={tab === "scan"}
          onPress={() => setTab("scan")}
          icon={<FileScan size={20} color={tab === "scan" ? palette.secondary : palette.darkMuted} />}
        />
        <BottomTabButton
          label="KOBİ"
          active={tab === "business"}
          onPress={() => setTab("business")}
          icon={<BriefcaseBusiness size={20} color={tab === "business" ? palette.secondary : palette.darkMuted} />}
        />
      </View>
      <DraggableAgentBubble onOpen={() => setAgentOpen(true)} />
      <AgentModal visible={agentOpen} onClose={() => setAgentOpen(false)} />
    </SafeAreaView>
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

function DraggableAgentBubble({ onOpen }: { onOpen: () => void }) {
  const { width, height } = Dimensions.get("window");
  const initial = useMemo(() => ({ x: width - 84, y: 112 }), [width]);
  const position = useRef(new Animated.ValueXY(initial)).current;
  const lastPosition = useRef(initial);
  const moved = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
        onPanResponderGrant: () => {
          moved.current = false;
          position.setOffset(lastPosition.current);
          position.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_, gesture) => {
          moved.current = moved.current || Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8;
          position.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_, gesture) => {
          const next = {
            x: Math.min(Math.max(lastPosition.current.x + gesture.dx, 12), width - 76),
            y: Math.min(Math.max(lastPosition.current.y + gesture.dy, 76), height - 176)
          };
          position.flattenOffset();
          position.setValue(next);
          lastPosition.current = next;
          if (!moved.current) {
            onOpen();
          }
        }
      }),
    [height, onOpen, position, width]
  );

  return (
    <Animated.View style={[localStyles.agentBubble, { transform: position.getTranslateTransform() }]} {...panResponder.panHandlers}>
      <View style={localStyles.agentBubbleInner}>
        <Bot size={28} color={palette.surface} />
        <Text style={localStyles.agentBubbleLabel}>İkiz</Text>
      </View>
    </Animated.View>
  );
}

function AgentModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={localStyles.agentModalBackdrop}>
        <SafeAreaView style={localStyles.agentModalSheet}>
          <View style={localStyles.agentModalHeader}>
            <View>
              <Text style={localStyles.overline}>Finansal İkiz</Text>
              <Text style={localStyles.cardTitle}>Agent paneli</Text>
            </View>
            <IconButton onPress={onClose} tone="muted">
              <X size={18} color={palette.ink} />
            </IconButton>
          </View>
          <ScrollView contentContainerStyle={localStyles.agentModalContent} showsVerticalScrollIndicator={false}>
            <AgentScreen />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
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
      <RiskAlerts alerts={dashboard.riskAlerts} monthlyLeak={monthlyLeak} leaks={leaks} />
      <SpendingDnaCard dna={dna} periodLabel={dashboard.periodLabel} />
      <CategoryRiskList dna={dna} periodLabel={dashboard.periodLabel} />
      <GoalsSection goals={dashboard.goals} />
      <ManualTransactionPanel onChanged={onRefresh} />
      <NotificationTokenPanel />
      <ActionCenter actions={dashboard.upcomingActions} onChanged={onRefresh} />
      <WhatIfPreview simulation={simulation} />
      <SubscriptionHunter leaks={leaks} />
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
          <Text style={localStyles.heroTitle}>Merhaba, {user.name}</Text>
          <Text style={localStyles.heroSubtitle}>
            {hasFinancialData
              ? "Finansal ikizin bu dönemki gelir, gider, risk ve aksiyon sinyallerini gerçek kayıtlarından izliyor."
              : "Gelir, gider, fiş veya ekstre eklediğinde finansal ikizin gerçek analiz üretmeye başlayacak."}
          </Text>
        </View>
        <View style={localStyles.heroActions}>
          <IconButton onPress={onLogout} tone="muted">
            <LogOut size={18} color={palette.ink} />
          </IconButton>
          <ScoreGauge score={dashboard.financialHealthScore} />
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

function ManualTransactionPanel({ onChanged }: { onChanged: () => void }) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [csv, setCsv] = useState("occurredAt,merchant,amount,categoryId,type\n");
  const [pending, setPending] = useState<"manual" | "csv" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function addManual() {
    const parsedAmount = parseDecimalInput(amount);
    if (!merchant.trim() || parsedAmount <= 0) {
      setStatus("Satıcı ve tutar gerekli.");
      return;
    }
    setPending("manual");
    setStatus(null);
    try {
      await createTransaction({
        merchant: merchant.trim(),
        amount: parsedAmount,
        type,
        currency,
        occurredAt: `${occurredAt}T12:00:00.000Z`,
        paymentMethod: type === "income" ? "transfer" : "debit_card"
      });
      setMerchant("");
      setAmount("");
      setStatus("İşlem eklendi.");
      onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "İşlem eklenemedi.");
    } finally {
      setPending(null);
    }
  }

  async function importCsv() {
    if (csv.trim().split(/\r?\n/).length < 2) {
      setStatus("CSV için başlık ve en az bir satır gerekli.");
      return;
    }
    setPending("csv");
    setStatus(null);
    try {
      const result = await importTransactionsCsv(csv);
      setStatus(`${result.imported} işlem içe aktarıldı.`);
      onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "CSV içe aktarılamadı.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Panel>
      <SectionTitle title="Manuel İşlem" meta="gelir/gider" />
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
      <Button label={pending === "manual" ? "Ekleniyor" : "İşlem ekle"} onPress={() => void addManual()} disabled={Boolean(pending)} icon={<Plus size={15} color={palette.surface} />} />

      <View style={styles.divider} />
      <SectionTitle title="CSV İçe Aktar" meta="toplu işlem" />
      <TextInput value={csv} onChangeText={setCsv} multiline textAlignVertical="top" style={[localStyles.authInput, localStyles.csvInput]} />
      <Button label={pending === "csv" ? "Aktarılıyor" : "CSV aktar"} variant="secondary" onPress={() => void importCsv()} disabled={Boolean(pending)} icon={<FileUp size={15} color={palette.ink} />} />
      {status ? <Text style={status.includes("gerekli") || status.includes("API") || status.includes("edilemedi") ? localStyles.authError : localStyles.formSuccess}>{status}</Text> : null}
    </Panel>
  );
}

function NotificationTokenPanel() {
  const platform = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    if (!token.trim()) {
      setStatus("Token gerekli.");
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await saveFcmToken({ token: token.trim(), platform });
      setToken("");
      setStatus("Bildirim tokenı kaydedildi.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Token kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel>
      <SectionTitle title="Bildirim Bağlantısı" meta={platform.toUpperCase()} />
      <View style={localStyles.agentInputShell}>
        <BellRing size={20} color={palette.primary} />
        <TextInput value={token} onChangeText={setToken} placeholder="FCM/APNs token" placeholderTextColor={palette.muted} style={[localStyles.authInput, localStyles.formInput]} />
      </View>
      <Button label={pending ? "Kaydediliyor" : "Token kaydet"} variant="secondary" onPress={() => void submit()} disabled={pending} />
      {status ? <Text style={status.includes("gerekli") || status.includes("API") || status.includes("kaydedilemedi") ? localStyles.authError : localStyles.formSuccess}>{status}</Text> : null}
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
          <View style={localStyles.actionButtons}>
            <Button label={delayMinutes ? `${delayMinutes} dakika beklet` : "Senaryoyu izle"} style={localStyles.flexButton} />
            <Button label="Alternatif fiyat" variant="secondary" icon={<Search size={15} color={palette.primary} />} style={localStyles.flexButton} />
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
      <View style={styles.row}>
        <Button label={leak.issue === "unused" ? "İptal taslağı" : leak.issue === "duplicate" ? "Tek planı tut" : "Plan düşür"} variant="secondary" />
        <Button label="Detay" variant="ghost" />
      </View>
    </View>
  );
}

function AgentScreen() {
  const [message, setMessage] = useState(defaultQuestion);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    const next = await sendAgentMessage(message);
    setResponse(next);
    Tts.setDefaultLanguage("tr-TR").catch(() => undefined);
    Tts.speak(next.answer);
    setLoading(false);
  }

  const routedAgents = response?.routedAgents.length ? response.routedAgents : ["Supervisor", "Simulation", "Risk"];

  return (
    <>
      <ScreenHeader
        eyebrow="Agent · Multi-agent finans danışmanı"
        title="Sor, ikiz açıklasın"
        subtitle="Önerilerin kanıtlara dayanır. Otomatik işlem yapılmaz."
      />

      <Panel>
        <View style={localStyles.agentInputShell}>
          <Bot size={20} color={palette.primary} />
          <TextInput
            value={message}
            onChangeText={setMessage}
            style={localStyles.agentInput}
            multiline
            textAlignVertical="top"
          />
          <IconButton onPress={ask} tone="primary">
            <Send size={19} color={palette.primary} />
          </IconButton>
        </View>
        <View style={styles.wrapRow}>
          {routedAgents.map((agent) => (
            <Badge key={agent} label={agent} tone="primary" />
          ))}
          <Badge label={response ? `%${Math.round(response.confidence * 100)} güven` : "%82 güven"} tone="teal" />
        </View>
      </Panel>

      {loading ? (
        <Panel>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.bodyMuted}>İkiz kanıtları topluyor...</Text>
        </Panel>
      ) : response ? (
        <AgentResult response={response} />
      ) : (
        <AgentEmpty onPress={ask} />
      )}
    </>
  );
}

function AgentEmpty({ onPress }: { onPress: () => void }) {
  return (
    <Panel style={localStyles.emptyPanel}>
      <Bot size={30} color={palette.primary} />
      <Text style={localStyles.cardTitle}>Soru hazır</Text>
      <Text style={styles.bodyMuted}>Gönderince Explainable AI paneli, kanıtlar ve aksiyon taslakları burada açılır.</Text>
      <Button label="Agent'a gönder" onPress={onPress} icon={<Send size={15} color={palette.surface} />} />
    </Panel>
  );
}

function AgentResult({ response }: { response: AgentResponse }) {
  const suggestedActions = response.suggestedActions.length
    ? response.suggestedActions.map((action) => action.title)
    : ["10 dakika beklet", "Güvenli senaryoyu uygula", "Alternatif fiyat ara"];

  return (
    <Panel>
      <View style={styles.rowBetween}>
        <Badge label="İkiz · Simulation Agent" tone="primary" />
        <Mono style={localStyles.agentLatency}>1.4s</Mono>
      </View>
      <Text style={localStyles.agentAnswer}>{response.answer}</Text>
      <View style={localStyles.actionButtons}>
        <Button label="Sesli oku" icon={<Mic2 size={15} color={palette.surface} />} onPress={() => Tts.speak(response.answer)} style={localStyles.flexButton} />
        <Button label="Yeniden" variant="ghost" icon={<RefreshCcw size={15} color={palette.ink} />} style={localStyles.flexButton} />
      </View>
      <View style={styles.divider} />
      <SectionTitle title="Kanıtlar" />
      <View style={localStyles.evidenceGrid}>
        {response.evidence.map((item) => (
          <View style={localStyles.evidenceItem} key={`${item.label}-${item.value}`}>
            <CheckCircle2 size={15} color={palette.teal} />
            <Text style={localStyles.evidenceLabel}>{item.label}</Text>
            <Mono style={localStyles.evidenceValue}>{item.value}</Mono>
          </View>
        ))}
      </View>
      <SectionTitle title="Önerilen aksiyonlar" />
      {suggestedActions.map((title, index) => (
        <View style={localStyles.suggestedAction} key={`${title}-${index}`}>
          <Text style={localStyles.cardTitle}>{title}</Text>
          <Text style={styles.bodyMuted}>
            {index === 0 ? "Emotional delay ile dürtüyü yavaşlat" : index === 1 ? "Güvenli limitte kal · sağlık +3" : "İkiz, son 30 gün fiyat geçmişine bakar"}
          </Text>
        </View>
      ))}
    </Panel>
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
    setPending(true);
    setStatus(null);
    try {
      await createBusiness({
        name: name.trim(),
        sector: sector.trim(),
        cashBalance: parseDecimalInput(cashBalance)
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
    if (!title.trim() || parsedAmount <= 0) {
      setStatus("Başlık ve pozitif tutar gerekli.");
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
    setPending(true);
    setStatus(null);
    try {
      await createBusinessCustomer(businessId, {
        name: name.trim(),
        averageDelayDays: parseIntegerInput(averageDelayDays),
        invoicesPaid: parseIntegerInput(invoicesPaid),
        invoicesLate: parseIntegerInput(invoicesLate),
        outstandingAmount: parseDecimalInput(outstandingAmount)
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

  async function runSimulation() {
    if (parsedAmount <= 0) {
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
        <MiniFact label="30 gün sonrası" value={money(dashboard.projected30Days - parsedAmount)} />
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
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDecimalInput(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIntegerInput(value: string) {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
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
  authScroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 18
  },
  authPanel: {
    gap: 16
  },
  authBrand: {
    gap: 8
  },
  authMark: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  authMarkText: {
    color: palette.surface,
    fontSize: 16,
    fontWeight: "900"
  },
  authSwitch: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: palette.surface2,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 4
  },
  authSwitchButton: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6
  },
  authSwitchActive: {
    backgroundColor: palette.surface
  },
  authSwitchText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  authSwitchTextActive: {
    color: palette.ink
  },
  authInput: {
    minHeight: 48,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: palette.ink,
    backgroundColor: "#FBFCFA",
    fontSize: 14
  },
  biometricCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: palette.surface2,
    padding: 12
  },
  biometricIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
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
    fontSize: 14,
    fontWeight: "900"
  },
  biometricCaption: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  },
  biometricRetry: {
    minHeight: 36,
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    paddingHorizontal: 10
  },
  biometricRetryText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "900"
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
  agentBubble: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 30,
    elevation: 18
  },
  agentBubbleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.primary,
    borderWidth: 3,
    borderColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { height: 8, width: 0 },
    elevation: 18
  },
  agentBubbleLabel: {
    color: palette.surface,
    fontSize: 10,
    fontWeight: "900"
  },
  agentModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    justifyContent: "flex-end"
  },
  agentModalSheet: {
    maxHeight: "92%",
    backgroundColor: palette.bg,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 12,
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
    backgroundColor: "#FBFCFF",
    borderColor: "#D8E2F5"
  },
  heroCopy: {
    flex: 1,
    gap: 7
  },
  heroActions: {
    alignItems: "flex-end",
    gap: 10
  },
  overline: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900"
  },
  heroSubtitle: {
    color: palette.muted,
    fontSize: 13.5,
    lineHeight: 20
  },
  balanceStrip: {
    backgroundColor: palette.secondary,
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  balanceLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  balanceValue: {
    color: palette.surface,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    marginTop: 4
  },
  balanceDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#263346"
  },
  periodPanel: {
    gap: 12
  },
  periodHeader: {
    marginBottom: -4
  },
  periodControl: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: palette.surface2,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 4
  },
  periodButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6
  },
  periodButtonActive: {
    backgroundColor: palette.secondary
  },
  periodButtonText: {
    color: palette.muted,
    fontSize: 12.5,
    fontWeight: "800"
  },
  periodButtonTextActive: {
    color: palette.surface
  },
  moduleCard: {
    minHeight: 86,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FBFCFA"
  },
  moduleIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primarySoft
  },
  moduleValue: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900"
  },
  alertCard: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10
  },
  alertIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
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
    borderRadius: 8,
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
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "800"
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
    borderColor: palette.line,
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: "#FBFCFA"
  },
  miniFact: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: "#FBFCFA"
  },
  miniLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  miniValue: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900"
  },
  patternCard: {
    borderLeftColor: palette.primary,
    borderLeftWidth: 3,
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    padding: 12
  },
  emptyMessage: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FBFCFA"
  },
  goalCard: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10
  },
  actionCard: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
    backgroundColor: "#FBFCFA"
  },
  actionMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700"
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
    gap: 4,
    backgroundColor: palette.surface2,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 4
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6
  },
  segmentButtonActive: {
    backgroundColor: palette.secondary
  },
  segmentButtonText: {
    color: palette.muted,
    fontSize: 12.5,
    fontWeight: "800"
  },
  segmentButtonTextActive: {
    color: palette.surface
  },
  csvInput: {
    minHeight: 112,
    lineHeight: 19
  },
  flexButton: {
    flexGrow: 1,
    flexBasis: "46%"
  },
  quote: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800"
  },
  scenarioCard: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 8
  },
  scenarioSelected: {
    borderColor: palette.danger,
    backgroundColor: "#FFF8F9"
  },
  scenarioAmount: {
    fontSize: 18,
    fontWeight: "900"
  },
  delayCard: {
    backgroundColor: palette.primarySoft,
    borderRadius: 8,
    padding: 12
  },
  timer: {
    color: palette.primary,
    fontSize: 20,
    fontWeight: "900"
  },
  leakTotal: {
    color: palette.primary,
    fontSize: 22,
    fontWeight: "900"
  },
  leakCard: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10
  },
  negativeValue: {
    color: palette.danger,
    fontSize: 15,
    fontWeight: "900"
  },
  positiveValue: {
    color: palette.success,
    fontSize: 15,
    fontWeight: "900"
  },
  agentInputShell: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  agentInput: {
    flex: 1,
    minHeight: 112,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: palette.ink,
    backgroundColor: "#FBFCFA",
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
    fontSize: 12,
    fontWeight: "800"
  },
  agentAnswer: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 27,
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
    backgroundColor: palette.surface2,
    borderRadius: 8,
    padding: 10,
    gap: 5
  },
  evidenceLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  evidenceValue: {
    color: palette.ink,
    fontSize: 13.5,
    fontWeight: "900"
  },
  suggestedAction: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 4
  },
  cfoHero: {
    backgroundColor: palette.secondary,
    borderColor: palette.secondary
  },
  cfoCash: {
    color: palette.surface,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    marginTop: 4
  },
  cfoDelta: {
    color: "#A7F3D0",
    fontSize: 12,
    fontWeight: "800",
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
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: palette.primary
  },
  sparkLabel: {
    color: palette.darkMuted,
    fontSize: 11,
    fontWeight: "800"
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
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10
  },
  collectionScore: {
    fontSize: 32,
    fontWeight: "900"
  },
  simInput: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: "#FBFCFA"
  },
  simAmountInput: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
    paddingVertical: 0
  },
  loading: {
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  }
});
