import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import Tts from "react-native-tts";
import { Bot, BriefcaseBusiness, Camera, Gauge, PiggyBank, ReceiptText, WalletCards } from "lucide-react-native";
import type {
  AgentResponse,
  BusinessDashboard,
  CollectionScore,
  DashboardSummary,
  ReceiptScanResult,
  SpendingDna,
  SubscriptionLeak,
  WhatIfResponse
} from "@fintwin/shared";
import { loadBusiness, loadMobileHome, scanReceipt, sendAgentMessage } from "./src/api";
import { palette, Panel, PillButton, RiskBar, Stat, styles } from "./src/ui";

type Tab = "home" | "agent" | "scan" | "business";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [home, setHome] = useState<{
    dashboard: DashboardSummary;
    dna: SpendingDna;
    leaks: SubscriptionLeak[];
    simulation: WhatIfResponse;
  } | null>(null);
  const [business, setBusiness] = useState<{ dashboard: BusinessDashboard; scores: CollectionScore[] } | null>(null);

  useEffect(() => {
    void loadMobileHome().then(setHome);
    void loadBusiness().then(setBusiness);
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === "home" && (home ? <HomeScreen {...home} /> : <Loading />)}
        {tab === "agent" && <AgentScreen />}
        {tab === "scan" && <ScanScreen />}
        {tab === "business" && (business ? <BusinessScreen {...business} /> : <Loading />)}
      </ScrollView>
      <View style={styles.tabBar}>
        <PillButton label="Kişisel" active={tab === "home"} onPress={() => setTab("home")} />
        <PillButton label="Agent" active={tab === "agent"} onPress={() => setTab("agent")} />
        <PillButton label="Fiş" active={tab === "scan"} onPress={() => setTab("scan")} />
        <PillButton label="KOBİ" active={tab === "business"} onPress={() => setTab("business")} />
      </View>
    </View>
  );
}

function HomeScreen({
  dashboard,
  dna,
  leaks,
  simulation
}: {
  dashboard: DashboardSummary;
  dna: SpendingDna;
  leaks: SubscriptionLeak[];
  simulation: WhatIfResponse;
}) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Fintwin Mobil</Text>
        <Text style={styles.title}>Finansal ikizin cebinde.</Text>
        <Text style={styles.subtitle}>iOS öncelikli demo; Android uyumlu React Native CLI temeli korunur.</Text>
      </View>
      <View style={styles.statGrid}>
        <Stat icon={<Gauge color={palette.accent} />} label="Sağlık" value={`${dashboard.financialHealthScore}/100`} />
        <Stat icon={<WalletCards color={palette.accent} />} label="Gelir" value={`${dashboard.income.toLocaleString("tr-TR")} TL`} />
        <Stat icon={<ReceiptText color={palette.accent} />} label="Gider" value={`${dashboard.expenses.toLocaleString("tr-TR")} TL`} />
        <Stat icon={<PiggyBank color={palette.accent} />} label="Tasarruf" value={`%${dashboard.savingsRate}`} />
      </View>
      <Panel>
        <Text style={styles.sectionTitle}>Spending DNA</Text>
        {dna.categories.slice(0, 4).map((item) => (
          <RiskBar key={item.categoryId} label={item.categoryName} value={item.riskScore} />
        ))}
      </Panel>
      <Panel>
        <Text style={styles.sectionTitle}>Scenario Compare</Text>
        {simulation.cards.map((card) => (
          <View style={styles.scenario} key={card.id}>
            <Text style={styles.muted}>{card.label}</Text>
            <Text style={styles.statValue}>{card.spendAmount.toLocaleString("tr-TR")} TL</Text>
            <Text style={styles.muted}>{card.recommendation}</Text>
          </View>
        ))}
      </Panel>
      <Panel>
        <Text style={styles.sectionTitle}>Abonelik Avcısı</Text>
        {leaks.map((leak) => (
          <View style={styles.row} key={`${leak.subscriptionId}-${leak.issue}`}>
            <Text style={styles.rowText}>{leak.merchant}</Text>
            <Text style={styles.muted}>{leak.monthlyImpact.toLocaleString("tr-TR")} TL</Text>
          </View>
        ))}
      </Panel>
    </>
  );
}

function AgentScreen() {
  const [message, setMessage] = useState("Bugün 10000 TL teknoloji harcaması yaparsam ne olur?");
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

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Sesli Finans Asistanı</Text>
        <Text style={styles.title}>Agent sorunu analiz eder ve açıklar.</Text>
      </View>
      <Panel>
        <Bot color={palette.accent} />
        <TextInput value={message} onChangeText={setMessage} style={styles.input} multiline />
        <TouchableOpacity style={styles.primaryButton} onPress={ask} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? "Analiz ediliyor" : "Agent'a sor ve sesli oku"}</Text>
        </TouchableOpacity>
      </Panel>
      {response ? (
        <Panel>
          <Text style={styles.sectionTitle}>Explainable AI</Text>
          <Text style={styles.subtitle}>{response.answer}</Text>
          {response.evidence.map((item) => (
            <View style={styles.row} key={`${item.label}-${item.value}`}>
              <Text style={styles.rowText}>{item.label}</Text>
              <Text style={styles.muted}>{item.value}</Text>
            </View>
          ))}
        </Panel>
      ) : null}
    </>
  );
}

function ScanScreen() {
  const [result, setResult] = useState<ReceiptScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    setLoading(true);
    const image = await launchImageLibrary({
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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Qwen OCR</Text>
        <Text style={styles.title}>Fişi finans kaydına çevir.</Text>
      </View>
      <Panel>
        <Camera color={palette.accent} />
        <Text style={styles.subtitle}>Tutar, tarih, satıcı, KDV, kategori ve ödeme tipi çıkarılır.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={pickImage} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? "Okunuyor" : "Fiş/fatura seç"}</Text>
        </TouchableOpacity>
      </Panel>
      {result ? (
        <Panel>
          <Text style={styles.sectionTitle}>{result.merchant}</Text>
          <Text style={styles.statValue}>{result.totalAmount.toLocaleString("tr-TR")} TL</Text>
          <Text style={styles.muted}>
            {result.occurredAt} · {result.categoryName} · KDV {result.taxAmount.toLocaleString("tr-TR")} TL
          </Text>
        </Panel>
      ) : null}
    </>
  );
}

function BusinessScreen({ dashboard, scores }: { dashboard: BusinessDashboard; scores: CollectionScore[] }) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Ayrı KOBİ Modülü</Text>
        <Text style={styles.title}>AI CFO Lite kişisel akıştan ayrıdır.</Text>
      </View>
      <View style={styles.statGrid}>
        <Stat icon={<BriefcaseBusiness color={palette.accent} />} label="Kasa" value={`${dashboard.cashBalance.toLocaleString("tr-TR")} TL`} />
        <Stat icon={<Gauge color={palette.accent} />} label="Risk" value={dashboard.liquidityRisk} />
      </View>
      <Panel>
        <Text style={styles.sectionTitle}>Nakit Akışı</Text>
        <RiskBar label="30 gün projeksiyon" value={Math.max(0, Math.min(100, Math.round(dashboard.projected30Days / 3000)))} />
        <RiskBar label="60 gün projeksiyon" value={Math.max(0, Math.min(100, Math.round(dashboard.projected60Days / 3000)))} />
        <RiskBar label="90 gün projeksiyon" value={Math.max(0, Math.min(100, Math.round(dashboard.projected90Days / 3000)))} />
      </Panel>
      <Panel>
        <Text style={styles.sectionTitle}>Tahsilat Skoru</Text>
        {scores.map((score) => (
          <View style={styles.row} key={score.customerId}>
            <Text style={styles.rowText}>{score.customerId}</Text>
            <Text style={styles.muted}>{score.score}/100</Text>
          </View>
        ))}
      </Panel>
    </>
  );
}

function Loading() {
  return (
    <View style={{ paddingTop: 80 }}>
      <ActivityIndicator color={palette.accent} />
    </View>
  );
}
