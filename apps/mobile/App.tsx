import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import Tts from "react-native-tts";
import { Bot, BriefcaseBusiness, Camera, FileText, Gauge, PiggyBank, ReceiptText, WalletCards } from "lucide-react-native";
import type {
  AgentResponse,
  BusinessDashboard,
  CollectionScore,
  DashboardSummary,
  ReceiptExpenseImportResult,
  SpendingDna,
  StatementImportResult,
  SubscriptionLeak,
  WhatIfResponse
} from "@fintwin/shared";
import { createSubscriptionReminder, importReceiptExpense, importStatement, loadBusiness, loadMobileHome, sendAgentMessage } from "./src/api";
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
        {tab === "scan" && <ScanScreen onImported={() => void loadMobileHome().then(setHome)} />}
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

function ScanScreen({ onImported }: { onImported: () => void }) {
  const [receiptResult, setReceiptResult] = useState<ReceiptExpenseImportResult | null>(null);
  const [statementResult, setStatementResult] = useState<StatementImportResult | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementMode, setStatementMode] = useState<"items" | "subscriptions">("items");
  const [reminderDates, setReminderDates] = useState<Record<string, string>>({});
  const [scheduledReminderId, setScheduledReminderId] = useState<string | null>(null);

  async function captureReceipt() {
    setReceiptLoading(true);
    const image = await launchCamera({
      mediaType: "photo",
      includeBase64: true,
      quality: 0.8
    });
    if (image.errorMessage) {
      Alert.alert("Kamera açılamadı", image.errorMessage);
    }
    if (!image.didCancel) {
      const asset = image.assets?.[0];
      const next = await importReceiptExpense(asset?.base64 ?? undefined, asset?.type ?? undefined);
      setReceiptResult(next);
      onImported();
    }
    setReceiptLoading(false);
  }

  async function pickStatement() {
    setStatementLoading(true);
    const image = await launchImageLibrary({
      mediaType: "photo",
      includeBase64: true,
      quality: 0.8
    });
    if (image.errorMessage) {
      Alert.alert("Ekstre seçilemedi", image.errorMessage);
    }
    if (!image.didCancel) {
      const asset = image.assets?.[0];
      const next = await importStatement(asset?.base64 ?? undefined, asset?.type ?? undefined);
      setStatementResult(next);
      setReminderDates(Object.fromEntries(next.recurringSubscriptions.map((subscription) => [subscription.id, subscription.nextEstimatedAt])));
      setStatementMode(next.recurringSubscriptions.length ? "subscriptions" : "items");
      onImported();
    }
    setStatementLoading(false);
  }

  async function scheduleSubscriptionReminder(subscriptionId: string) {
    const subscription = statementResult?.recurringSubscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) return;
    const remindAt = reminderDates[subscription.id] ?? subscription.nextEstimatedAt;
    await createSubscriptionReminder({
      merchant: subscription.merchant,
      amount: subscription.amount,
      remindAt,
      note: `${statementResult?.statementMonth} ekstresinden tespit edildi`
    });
    setScheduledReminderId(subscription.id);
    onImported();
  }

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Belge Agent'ları</Text>
        <Text style={styles.title}>Fiş ve ekstreyi giderlere ekle.</Text>
      </View>
      <Panel>
        <Camera color={palette.accent} />
        <Text style={styles.subtitle}>Receipt Agent kameradan okur, kategoriyi bulur ve tek gider transaction'ı oluşturur.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={captureReceipt} disabled={receiptLoading}>
          <Text style={styles.primaryButtonText}>{receiptLoading ? "Gider ekleniyor" : "Fişi kameradan okut"}</Text>
        </TouchableOpacity>
      </Panel>
      {receiptResult ? (
        <Panel>
          <Text style={styles.sectionTitle}>{receiptResult.receipt.merchant}</Text>
          <Text style={styles.statValue}>{receiptResult.transaction.amount.toLocaleString("tr-TR")} TL</Text>
          <Text style={styles.muted}>
            {receiptResult.receipt.occurredAt} · {receiptResult.receipt.categoryName} · giderlere eklendi
          </Text>
        </Panel>
      ) : null}
      <Panel>
        <FileText color={palette.accent} />
        <Text style={styles.subtitle}>Statement Agent ay sonu ekstresindeki tüm harcama kalemlerini ayırır ve kategorize eder.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={pickStatement} disabled={statementLoading}>
          <Text style={styles.primaryButtonText}>{statementLoading ? "Ekstre işleniyor" : "Ekstre görseli yükle"}</Text>
        </TouchableOpacity>
      </Panel>
      {statementResult ? (
        <Panel>
          <Text style={styles.sectionTitle}>{statementResult.statementMonth} ekstresi</Text>
          <Text style={styles.statValue}>{statementResult.totalAmount.toLocaleString("tr-TR")} TL</Text>
          <Text style={styles.muted}>{statementResult.importedCount} kalem giderlere eklendi.</Text>
          <View style={styles.segmented}>
            <TouchableOpacity style={[styles.segment, statementMode === "items" && styles.segmentActive]} onPress={() => setStatementMode("items")}>
              <Text style={statementMode === "items" ? styles.segmentTextActive : styles.segmentText}>Kalemler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.segment, statementMode === "subscriptions" && styles.segmentActive]} onPress={() => setStatementMode("subscriptions")}>
              <Text style={statementMode === "subscriptions" ? styles.segmentTextActive : styles.segmentText}>Abonelikler</Text>
            </TouchableOpacity>
          </View>
          {statementMode === "items"
            ? (statementResult.transactions.length ? statementResult.transactions : statementResult.items).slice(0, 6).map((item) => (
                <View style={styles.row} key={`${item.merchant}-${item.amount}-${item.occurredAt}`}>
                  <Text style={styles.rowText}>{item.merchant}</Text>
                  <Text style={styles.muted}>{item.amount.toLocaleString("tr-TR")} TL</Text>
                </View>
              ))
            : statementResult.recurringSubscriptions.map((subscription) => (
                <View style={styles.subscriptionCard} key={subscription.id}>
                  <Text style={styles.rowText}>{subscription.merchant}</Text>
                  <Text style={styles.muted}>
                    {subscription.amount.toLocaleString("tr-TR")} TL · {subscription.occurrenceCount} tekrar · önerilen {subscription.nextEstimatedAt}
                  </Text>
                  <TextInput
                    value={reminderDates[subscription.id] ?? subscription.nextEstimatedAt}
                    onChangeText={(value) => setReminderDates((current) => ({ ...current, [subscription.id]: value }))}
                    style={styles.dateInput}
                    placeholder="YYYY-MM-DD"
                  />
                  <TouchableOpacity style={styles.primaryButton} onPress={() => scheduleSubscriptionReminder(subscription.id)}>
                    <Text style={styles.primaryButtonText}>{scheduledReminderId === subscription.id ? "Hatırlatma kuruldu" : "Bu tarihte hatırlat"}</Text>
                  </TouchableOpacity>
                </View>
              ))}
          {statementMode === "subscriptions" && !statementResult.recurringSubscriptions.length ? <Text style={styles.muted}>Tekrar eden abonelik bulunamadı.</Text> : null}
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
