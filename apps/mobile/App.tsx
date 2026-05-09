import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import Tts from "react-native-tts";
import {
  AlertTriangle,
  Bot,
  BriefcaseBusiness,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  FileScan,
  Landmark,
  Mic2,
  PauseCircle,
  ReceiptText,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  Target,
  Trash2,
  Upload,
  WalletCards,
  X
} from "lucide-react-native";
import type {
  ActionItem,
  AgentResponse,
  BusinessDashboard,
  CollectionScore,
  DashboardSummary,
  Goal,
  ReceiptScanResult,
  ScenarioCard,
  SpendingDna,
  SubscriptionLeak,
  WhatIfResponse
} from "@fintwin/shared";
import { loadBusiness, loadMobileHome, scanReceipt, sendAgentMessage } from "./src/api";
import { Badge, BottomTabButton, Button, Gauge as ScoreGauge, IconButton, MetricCard, Mono, Panel, ProgressBar, RiskBar, ScreenHeader, SectionTitle, palette, styles } from "./src/ui";

type Tab = "home" | "agent" | "scan" | "business";
type HomeData = Awaited<ReturnType<typeof loadMobileHome>>;
type BusinessData = Awaited<ReturnType<typeof loadBusiness>>;

const demoQuestion = "Bugün 10.000 ₺ teknoloji harcaması yaparsam ne olur?";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [home, setHome] = useState<HomeData | null>(null);
  const [business, setBusiness] = useState<BusinessData | null>(null);

  useEffect(() => {
    void loadMobileHome().then(setHome);
    void loadBusiness().then(setBusiness);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.bg} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === "home" && (home ? <HomeScreen {...home} /> : <Loading />)}
        {tab === "agent" && <AgentScreen />}
        {tab === "scan" && <ScanScreen />}
        {tab === "business" && (business ? <BusinessScreen {...business} /> : <Loading />)}
      </ScrollView>
      <View style={styles.tabBar}>
        <BottomTabButton
          label="Kişisel"
          active={tab === "home"}
          onPress={() => setTab("home")}
          icon={<WalletCards size={20} color={tab === "home" ? palette.secondary : palette.darkMuted} />}
        />
        <BottomTabButton
          label="Agent"
          active={tab === "agent"}
          onPress={() => setTab("agent")}
          icon={<Bot size={20} color={tab === "agent" ? palette.secondary : palette.darkMuted} />}
        />
        <BottomTabButton
          label="Fiş"
          active={tab === "scan"}
          onPress={() => setTab("scan")}
          icon={<ReceiptText size={20} color={tab === "scan" ? palette.secondary : palette.darkMuted} />}
        />
        <BottomTabButton
          label="KOBİ"
          active={tab === "business"}
          onPress={() => setTab("business")}
          icon={<BriefcaseBusiness size={20} color={tab === "business" ? palette.secondary : palette.darkMuted} />}
        />
      </View>
    </SafeAreaView>
  );
}

function HomeScreen({
  dashboard,
  dna,
  campaign,
  leaks,
  simulation
}: {
  dashboard: DashboardSummary;
  dna: SpendingDna;
  campaign: HomeData["campaign"];
  leaks: SubscriptionLeak[];
  simulation: WhatIfResponse;
}) {
  const subscriptionLeaks = useMemo(() => withTrialLeak(leaks), [leaks]);
  const monthlyLeak = subscriptionLeaks.reduce((total, leak) => total + leak.monthlyImpact, 0);

  return (
    <>
      <FinancialHero dashboard={dashboard} simulation={simulation} />

      <View style={styles.metricGrid}>
        <MetricCard
          icon={<WalletCards size={18} color={palette.primary} />}
          label="Gelir"
          value={money(dashboard.income)}
          caption="Mayıs 2026"
          tone="primary"
        />
        <MetricCard
          icon={<ReceiptText size={18} color={palette.warn} />}
          label="Gider"
          value={money(dashboard.expenses)}
          caption="sabit + kart"
          tone="warn"
        />
        <MetricCard
          icon={<Target size={18} color={palette.teal} />}
          label="Tasarruf"
          value={`%${dashboard.savingsRate}`}
          caption={`hedef %35 · kampanya skoru ${campaign.score}`}
          tone="teal"
        />
        <MetricCard
          icon={<ShieldAlert size={18} color={palette.danger} />}
          label="Güvenli limit"
          value={money(simulation.safeLimit)}
          caption="Teknoloji kategorisi"
          tone="danger"
        />
      </View>

      <RiskAlerts monthlyLeak={monthlyLeak} simulation={simulation} />
      <SpendingDnaCard dna={dna} />
      <CategoryRiskList dna={dna} />
      <GoalsSection goals={dashboard.goals} />
      <ActionCenter actions={dashboard.upcomingActions} />
      <WhatIfPreview simulation={simulation} />
      <SubscriptionHunter leaks={subscriptionLeaks} />
    </>
  );
}

function FinancialHero({ dashboard, simulation }: { dashboard: DashboardSummary; simulation: WhatIfResponse }) {
  const monthEnd = simulation.cards[0]?.monthEndBalance ?? dashboard.balance;

  return (
    <Panel style={localStyles.hero}>
      <View style={styles.rowBetween}>
        <View style={localStyles.heroCopy}>
          <Text style={localStyles.overline}>Kişisel · Mayıs 2026</Text>
          <Text style={localStyles.heroTitle}>Merhaba, Seyit</Text>
          <Text style={localStyles.heroSubtitle}>
            Teknoloji harcamaların bu ay güvenli limiti aştı. Sakin kal, ikizin kanıtlarla bakıyor.
          </Text>
        </View>
        <ScoreGauge score={dashboard.financialHealthScore} />
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

function RiskAlerts({ monthlyLeak, simulation }: { monthlyLeak: number; simulation: WhatIfResponse }) {
  return (
    <Panel>
      <SectionTitle title="Risk Uyarıları" meta="2 aktif sinyal" />
      <AlertCard
        icon={<AlertTriangle size={18} color={palette.warn} />}
        badge="Kampanya Riski"
        title="Teknoloji harcaması güvenli limiti aştı"
        description={`9.800 ₺ harcandı · güvenli limit ${money(simulation.safeLimit)}`}
        action="İncele"
        tone="warn"
      />
      <AlertCard
        icon={<ShieldAlert size={18} color={palette.danger} />}
        badge="Abonelik sızıntısı"
        title={`Ayda ${money(monthlyLeak)} tasarruf potansiyeli`}
        description="StreamPlus, CloudBox ve NewsDaily ikiz tarafından işaretlendi."
        action="Avcıyı aç"
        tone="danger"
      />
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
      <Text style={[localStyles.actionLink, { color: tone === "danger" ? palette.danger : palette.warn }]}>{action}</Text>
    </View>
  );
}

function SpendingDnaCard({ dna }: { dna: SpendingDna }) {
  return (
    <Panel>
      <SectionTitle title="Spending DNA" meta="ikiz davranış profili" />
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

function CategoryRiskList({ dna }: { dna: SpendingDna }) {
  return (
    <Panel>
      <SectionTitle title="Kategori Riskleri" meta="Mayıs ayı" />
      <View style={styles.wrapRow}>
        <Badge label="Hepsi" tone="primary" />
        <Badge label="Kira" tone="danger" />
        <Badge label="Teknoloji" tone="danger" />
        <Badge label="Abonelik" tone="warn" />
      </View>
      {dna.categories.slice(0, 4).map((item) => (
        <RiskBar
          key={item.categoryId}
          label={item.categoryName}
          value={item.riskScore}
          amount={money(item.monthlySpend)}
        />
      ))}
    </Panel>
  );
}

function GoalsSection({ goals }: { goals: Goal[] }) {
  return (
    <Panel>
      <SectionTitle title="Hedefler" meta="Hedef ekle" />
      {goals.map((goal) => {
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
      })}
    </Panel>
  );
}

function ActionCenter({ actions }: { actions: ActionItem[] }) {
  return (
    <Panel>
      <SectionTitle title="Aksiyon Merkezi" meta={`Onay bekleyen ${actions.length} öneri`} />
      {actions.map((action) => (
        <ActionCard key={action.id} action={action} />
      ))}
    </Panel>
  );
}

function ActionCard({ action }: { action: ActionItem }) {
  const isDelay = action.type === "delay_purchase";

  return (
    <View style={localStyles.actionCard}>
      <View style={styles.rowBetween}>
        <Badge label={isDelay ? "Emotional Delay" : "Hatırlatıcı"} tone={isDelay ? "primary" : "teal"} />
        <Text style={localStyles.actionMeta}>{action.dueAt ? "14 Mayıs · 18:00" : "aktivasyon bekliyor"}</Text>
      </View>
      <Text style={localStyles.cardTitle}>{action.title}</Text>
      <Text style={styles.bodyMuted}>{action.description}</Text>
      <View style={localStyles.actionButtons}>
        <Button label="Onayla" icon={<Check size={15} color={palette.surface} />} style={localStyles.actionButton} />
        <Button label="Düzenle" variant="ghost" icon={<Edit3 size={15} color={palette.ink} />} style={localStyles.actionButton} />
        <Button label="Reddet" variant="danger" icon={<X size={15} color={palette.danger} />} style={localStyles.actionButton} />
      </View>
    </View>
  );
}

function WhatIfPreview({ simulation }: { simulation: WhatIfResponse }) {
  return (
    <Panel>
      <SectionTitle title="What-If Senaryosu" meta="Emotional Delay" />
      <Text style={localStyles.quote}>“10.000 ₺ teknoloji harcarsam ne olur?”</Text>
      <View style={styles.wrapRow}>
        {[3900, 7000, 10000, 15000].map((amount) => (
          <Badge key={amount} label={money(amount)} tone={amount === simulation.safeLimit ? "teal" : amount >= 10000 ? "danger" : "primary"} />
        ))}
      </View>
      {simulation.cards.map((card) => (
        <ScenarioCardView key={card.id} card={card} />
      ))}
      <View style={localStyles.delayCard}>
        <View style={styles.row}>
          <PauseCircle size={20} color={palette.primary} />
          <View style={localStyles.alertCopy}>
            <Text style={localStyles.cardTitle}>{simulation.emotionalDelayMinutes || 10} dakika beklet</Text>
            <Text style={styles.bodyMuted}>İkizin sakin bir karar için bekleme önerir.</Text>
          </View>
          <Mono style={localStyles.timer}>10:00</Mono>
        </View>
      </View>
      <View style={localStyles.actionButtons}>
        <Button label="10 dakika beklet" style={localStyles.flexButton} />
        <Button label="Alternatif fiyat" variant="secondary" icon={<Search size={15} color={palette.primary} />} style={localStyles.flexButton} />
      </View>
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
      {leaks.map((leak) => (
        <SubscriptionLeakCard key={`${leak.subscriptionId}-${leak.issue}`} leak={leak} />
      ))}
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
  const [message, setMessage] = useState(demoQuestion);
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

function ScanScreen() {
  const [result, setResult] = useState<ReceiptScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function scanFrom(source: "camera" | "library") {
    setLoading(true);
    const image = await (source === "camera" ? launchCamera : launchImageLibrary)({
      mediaType: "photo",
      includeBase64: true
    });
    if (image.errorMessage) {
      Alert.alert("Görsel seçilemedi", image.errorMessage);
    }
    if (!image.didCancel) {
      const asset = image.assets?.[0];
      const next = await scanReceipt(asset?.base64 ?? undefined, asset?.type ?? undefined);
      setResult(next);
    }
    setLoading(false);
  }

  return (
    <>
      <ScreenHeader
        eyebrow="Fiş & Fatura"
        title="Fişi tarayıp kayıt et"
        subtitle="Görselden tutar, KDV, kategori ve kalemleri çıkarırız."
      />
      {loading ? (
        <ReceiptScanning />
      ) : result ? (
        <ReceiptResult result={result} onScanAgain={() => scanFrom("camera")} />
      ) : (
        <ReceiptEmpty onCaptureImage={() => scanFrom("camera")} onPickImage={() => scanFrom("library")} />
      )}
    </>
  );
}

function ReceiptEmpty({ onCaptureImage, onPickImage }: { onCaptureImage: () => void; onPickImage: () => void }) {
  return (
    <>
      <Panel style={localStyles.uploadPanel}>
        <View style={localStyles.scanFrame}>
          <Camera size={32} color={palette.primary} />
          <Text style={localStyles.cardTitle}>Fiş veya fatura çek</Text>
          <Text style={styles.bodyMuted}>Köşelerini çerçeveye hizala</Text>
        </View>
        <View style={localStyles.actionButtons}>
          <Button label="Kameradan çek" icon={<Camera size={15} color={palette.surface} />} onPress={onCaptureImage} style={localStyles.flexButton} />
          <Button label="Galeriden seç" variant="secondary" icon={<Upload size={15} color={palette.primary} />} onPress={onPickImage} style={localStyles.flexButton} />
        </View>
        <Button label="Manuel gir" variant="ghost" icon={<Edit3 size={15} color={palette.ink} />} />
      </Panel>
      <Panel>
        <SectionTitle title="Son taramalar" meta="bu hafta 4 kayıt" />
        <RecentScan title="BIM Mağaza · Şişli" category="Market · 7 May" amount="318,50 ₺" />
        <RecentScan title="Migros Jet · Beşiktaş" category="Market · 6 May" amount="142,20 ₺" />
        <RecentScan title="Shell İstinye" category="Ulaşım · 4 May" amount="1.480,00 ₺" />
      </Panel>
    </>
  );
}

function ReceiptScanning() {
  return (
    <Panel style={localStyles.emptyPanel}>
      <FileScan size={34} color={palette.primary} />
      <ActivityIndicator color={palette.primary} />
      <Text style={localStyles.cardTitle}>Tarama sürüyor</Text>
      <Text style={styles.bodyMuted}>Qwen OCR tutar, KDV, kategori ve ödeme tipini ayrıştırıyor.</Text>
    </Panel>
  );
}

function ReceiptResult({ result, onScanAgain }: { result: ReceiptScanResult; onScanAgain: () => void }) {
  return (
    <Panel>
      <View style={styles.rowBetween}>
        <Badge label="Tarama başarılı" tone="teal" />
        <Badge label={`Güven %${Math.round(result.confidence * 100)}`} tone="primary" />
      </View>
      <View>
        <Text style={localStyles.receiptMerchant}>{result.merchant}</Text>
        <Text style={styles.bodyMuted}>Kadıköy / İstanbul · {result.occurredAt} 14:32</Text>
      </View>
      <View style={styles.metricGrid}>
        <MiniFact label="Toplam" value={money(result.totalAmount)} />
        <MiniFact label="KDV" value={money(result.taxAmount)} />
        <MiniFact label="Kategori" value={result.categoryName} />
        <MiniFact label="Ödeme" value={paymentLabel(result.paymentMethod)} />
      </View>
      <SectionTitle title="Kalemler" meta={`${result.lineItems.length} kayıt`} />
      {result.lineItems.map((item) => (
        <View style={localStyles.lineItem} key={`${item.name}-${item.amount}`}>
          <View style={localStyles.alertCopy}>
            <Text style={localStyles.cardTitle}>{item.name}</Text>
            <Text style={styles.bodyMuted}>{item.name === "Temel gıda" ? "ekmek, süt, yumurta, peynir" : "çamaşır, deterjan, sabun"}</Text>
          </View>
          <Mono style={localStyles.lineAmount}>{money(item.amount)}</Mono>
        </View>
      ))}
      <View style={localStyles.actionButtons}>
        <Button label="İşlem olarak kaydet" icon={<Check size={15} color={palette.surface} />} style={localStyles.flexButton} />
        <Button label="Düzenle" variant="ghost" icon={<Edit3 size={15} color={palette.ink} />} style={localStyles.flexButton} />
      </View>
      <Button label="Tekrar tara" variant="secondary" icon={<RefreshCcw size={15} color={palette.primary} />} onPress={onScanAgain} />
      <View style={localStyles.patternCard}>
        <Text style={styles.body}>
          İkiz önerisi: “Market” kategorisi ay başından beri %18 üzerinde. Hafta sonu alışveriş hassasiyeti yüksek.
        </Text>
      </View>
    </Panel>
  );
}

function RecentScan({ title, category, amount }: { title: string; category: string; amount: string }) {
  return (
    <View style={localStyles.recentScan}>
      <View style={styles.row}>
        <View style={localStyles.receiptIcon}>
          <ReceiptText size={16} color={palette.primary} />
        </View>
        <View style={localStyles.alertCopy}>
          <Text style={localStyles.cardTitle}>{title}</Text>
          <Text style={styles.bodyMuted}>{category}</Text>
        </View>
      </View>
      <Mono style={localStyles.lineAmount}>{amount}</Mono>
    </View>
  );
}

function BusinessScreen({ dashboard, scores }: { dashboard: BusinessDashboard; scores: CollectionScore[] }) {
  return (
    <>
      <ScreenHeader
        eyebrow="KOBİ · İşletme ikizi"
        title="AI CFO Lite"
        subtitle="Nakit akışı, projeksiyon ve tahsilat skorları eğitim amaçlıdır."
        right={<Building2 size={28} color={palette.primary} />}
      />
      <Panel style={localStyles.cfoHero}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={localStyles.balanceLabel}>Kasa</Text>
            <Mono style={localStyles.cfoCash}>{money(dashboard.cashBalance)}</Mono>
            <Text style={localStyles.cfoDelta}>12.400 ₺ · son 7 gün</Text>
          </View>
          <Badge label={`Likidite: ${riskLabel(dashboard.liquidityRisk)}`} tone={dashboard.liquidityRisk === "low" ? "teal" : "warn"} />
        </View>
        <View style={localStyles.sparkline}>
          {[34, 48, 42, 64, 54, 71, 58].map((height, index) => (
            <View key={index} style={[localStyles.sparkBar, { height }]} />
          ))}
        </View>
        <View style={styles.rowBetween}>
          {["Mar", "Nis", "May", "Haz", "Tem"].map((month) => (
            <Text style={localStyles.sparkLabel} key={month}>
              {month}
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
      <CollectionScores scores={scores} />
      <AiCfoSimulation dashboard={dashboard} />
    </>
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
      {dashboard.expectedCollections.map((event, index) => (
        <View style={localStyles.cashRow} key={event.id}>
          <View style={localStyles.alertCopy}>
            <Text style={localStyles.cardTitle}>{index === 0 ? "Northwind Inc." : "Atlas Perakende"}</Text>
            <Text style={styles.bodyMuted}>{event.dueAt} · ödeme skoru {index === 0 ? "78" : "32"}/100</Text>
          </View>
          <Mono style={localStyles.positiveValue}>+ {money(event.amount)}</Mono>
        </View>
      ))}
    </Panel>
  );
}

function CollectionScores({ scores }: { scores: CollectionScore[] }) {
  return (
    <Panel>
      <SectionTitle title="Tahsilat skorları" meta="müşteri ödeme davranışı" />
      {scores.map((score) => {
        const name = score.customerId === "cus-2" ? "Atlas Perakende" : "Mavi Lojistik";
        return (
          <View style={localStyles.collectionCard} key={score.customerId}>
            <View style={styles.rowBetween}>
              <View style={localStyles.alertCopy}>
                <Text style={localStyles.cardTitle}>{name}</Text>
                <Text style={styles.bodyMuted}>
                  {riskLabel(score.riskLevel)} · {score.riskLevel === "critical" ? "37" : "12"} gün gecikme
                </Text>
              </View>
              <Mono style={[localStyles.collectionScore, { color: score.riskLevel === "critical" ? palette.danger : palette.warn }]}>
                {score.score}
              </Mono>
            </View>
            <ProgressBar value={score.score} tone={score.riskLevel === "critical" ? "danger" : "warn"} />
            <Text style={styles.bodyMuted}>{score.recommendation}</Text>
            <View style={styles.row}>
              <Button label="Hatırlatma" variant="secondary" />
              <Button label="Plan" variant="ghost" />
            </View>
          </View>
        );
      })}
    </Panel>
  );
}

function AiCfoSimulation({ dashboard }: { dashboard: BusinessDashboard }) {
  return (
    <Panel>
      <SectionTitle title="Kararı simüle et" meta="ikiz CFO önerisi" />
      <View style={localStyles.simInput}>
        <Text style={styles.bodyMuted}>Yeni yatırım tutarı:</Text>
        <Mono style={localStyles.simAmount}>75.000 ₺</Mono>
      </View>
      <View style={styles.metricGrid}>
        <MiniFact label="30 gün sonrası" value={money(dashboard.projected30Days - 75000)} />
        <MiniFact label="Likidite" value={riskLabel(dashboard.liquidityRisk)} />
      </View>
      <Text style={styles.body}>
        İkiz CFO: Bu tutar, 30 gün projeksiyonunu sağlıklı şekilde karşılar. Onaylanabilir taslak hazırlayayım mı?
      </Text>
      <Button label="Aksiyon taslağı oluştur" icon={<FileScan size={15} color={palette.surface} />} />
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
      <Text style={styles.bodyMuted}>Demo veriler hazırlanıyor...</Text>
    </View>
  );
}

function money(value: number) {
  return `${Math.round(value).toLocaleString("tr-TR")} ₺`;
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

function paymentLabel(method: string) {
  return {
    cash: "Nakit",
    debit_card: "Banka kartı",
    credit_card: "Kredi kartı",
    transfer: "Transfer"
  }[method] ?? method;
}

function leakIssueLabel(issue: SubscriptionLeak["issue"]) {
  return {
    unused: "Kullanılmıyor",
    duplicate: "Mükerrer",
    small_leak: "Yeni",
    price_increase: "Fiyat artışı"
  }[issue];
}

function withTrialLeak(leaks: SubscriptionLeak[]): SubscriptionLeak[] {
  if (leaks.some((leak) => leak.subscriptionId === "sub-newsdaily")) return leaks;
  return leaks.concat({
    subscriptionId: "sub-newsdaily",
    merchant: "NewsDaily",
    issue: "small_leak",
    monthlyImpact: 79,
    recommendation: "14 günlük deneme bitti, ücretli geçiş başlamadan incele."
  });
}

const localStyles = StyleSheet.create({
  hero: {
    backgroundColor: "#FBFCFF",
    borderColor: "#D8E2F5"
  },
  heroCopy: {
    flex: 1,
    gap: 7
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
  uploadPanel: {
    gap: 14
  },
  scanFrame: {
    minHeight: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 20
  },
  recentScan: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    paddingTop: 12
  },
  receiptIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  receiptMerchant: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900"
  },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderTopColor: palette.line,
    borderTopWidth: 1,
    paddingTop: 12
  },
  lineAmount: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900"
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
  simAmount: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  loading: {
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  }
});
