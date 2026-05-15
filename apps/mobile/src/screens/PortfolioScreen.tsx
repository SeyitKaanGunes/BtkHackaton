import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import DocumentPicker from "react-native-document-picker";
import * as RNFS from "react-native-fs";
import { CheckCircle2, FileText, FileUp, Plus, Search, Trash2, TrendingDown, TrendingUp, X } from "lucide-react-native";
import { statementErrorMessage, type Currency, type Goal, type InvestmentAssetType, type InvestmentPortfolioSummary, type MarketSymbolResult, type StatementConfirmResult, type StatementPreviewResult } from "@fintwin/shared";
import { addInvestmentHolding, ApiRequestError, confirmStatementImport, createSubscriptionReminder, deleteInvestmentHolding, importStatementPreview, loadInvestmentPortfolio, loadPlanningOverview, searchInvestmentSymbols, StatementApiError } from "../api";
import { Btn, Card, Chip, Divider, Eyebrow, KV, Muted, ScreenHeader, SectionTitle } from "../ui";
import { radius, space, usePalette } from "../theme";

const assetTypes: Array<{ value: InvestmentAssetType; label: string }> = [
  { value: "stock", label: "Hisse" },
  { value: "gold", label: "Altin" },
  { value: "commodity", label: "Emtia" },
  { value: "forex", label: "Doviz" },
  { value: "crypto", label: "Kripto" },
  { value: "fund", label: "Fon" },
  { value: "cash", label: "Nakit / Mevduat" },
  { value: "other", label: "Diger" }
];

const currencies: Currency[] = ["TRY", "USD", "EUR"];

type StatementFlow =
  | { phase: "idle" }
  | { phase: "preview"; data: StatementPreviewResult; selected: Set<number>; skipDuplicates: boolean }
  | { phase: "confirmed"; data: StatementConfirmResult };

export function BankStatementImporter({ onImported }: { onImported?: () => void }) {
  const [statementFlow, setStatementFlow] = useState<StatementFlow>({ phase: "idle" });
  const [statementLoading, setStatementLoading] = useState(false);

  async function pickBankStatement() {
    try {
      setStatementLoading(true);
      const file = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.pdf], copyTo: "cachesDirectory" });
      const sourceUri = file.fileCopyUri ?? file.uri;
      const base64 = await RNFS.readFile(normalizeFileUri(sourceUri), "base64");
      const data = await importStatementPreview(base64, file.type ?? "application/pdf", file.name ?? "banka-ekstresi.pdf");
      setStatementFlow({
        phase: "preview",
        data,
        selected: new Set(data.items.filter((item) => !item.existingTransactionId).map((item) => item.index)),
        skipDuplicates: true
      });
    } catch (error) {
      if (DocumentPicker.isCancel(error)) return;
      Alert.alert("Ekstre yüklenemedi", formatStatementError(error, "Banka ekstresi okunamadı."));
    } finally {
      setStatementLoading(false);
    }
  }

  async function confirmBankStatement() {
    if (statementFlow.phase !== "preview") return;
    if (countImportableSelected(statementFlow.data, statementFlow.selected, statementFlow.skipDuplicates) === 0) {
      Alert.alert("Kalem seçilmedi", "İçe aktarılacak yeni ekstre kalemi seç.");
      return;
    }
    try {
      setStatementLoading(true);
      const result = await confirmStatementImport(statementFlow.data.documentId, [...statementFlow.selected], statementFlow.skipDuplicates);
      setStatementFlow({ phase: "confirmed", data: result });
      onImported?.();
    } catch (error) {
      Alert.alert("Ekstre işlenemedi", formatStatementError(error, "Ekstre kalemleri giderlere eklenemedi."));
    } finally {
      setStatementLoading(false);
    }
  }

  return (
    <BankStatementCard
      flow={statementFlow}
      loading={statementLoading}
      onPick={() => void pickBankStatement()}
      onConfirm={() => void confirmBankStatement()}
      setFlow={setStatementFlow}
    />
  );
}

export function PortfolioScreen({ onImported }: { onImported?: () => void }) {
  const p = usePalette();
  const [portfolio, setPortfolio] = useState<InvestmentPortfolioSummary | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketSymbolResult[]>([]);
  const [selected, setSelected] = useState<MarketSymbolResult | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [averageCost, setAverageCost] = useState("");
  const [annualInterestRate, setAnnualInterestRate] = useState("");
  const [assetType, setAssetType] = useState<InvestmentAssetType>("stock");
  const [costCurrency, setCostCurrency] = useState<Currency>("TRY");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isCash = assetType === "cash";

  useEffect(() => {
    void loadInvestmentPortfolio().then(setPortfolio);
    void loadPlanningOverview()
      .then((planning) => setGoals(planning.goals))
      .catch(() => setGoals([]));
  }, []);

  useEffect(() => {
    if (isCash) {
      setResults([]);
      return undefined;
    }
    const handle = setTimeout(() => {
      void searchInvestmentSymbols(query).then(setResults);
    }, 260);
    return () => clearTimeout(handle);
  }, [isCash, query]);

  const sourceLabel = useMemo(() => {
    if (!portfolio) return "Twelve Data";
    return portfolio.hasMarketDataGap ? "Piyasa verisi eksik" : "Twelve Data";
  }, [portfolio]);

  async function addHolding() {
    const symbol = isCash ? undefined : selected?.symbol ?? query.trim().toUpperCase();
    if (!isCash && !symbol) {
      setMessage(isCash ? "Tutar gerekli." : "Sembol ve adet gerekli.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const parsedQuantity = parseRequiredPositiveNumber(quantity, isCash ? "Tutar" : "Adet");
      const parsedAverageCost = isCash ? 1 : parseRequiredPositiveNumber(averageCost, "Alış fiyatı");
      const parsedAnnualInterestRate = isCash ? parseOptionalPositiveNumber(annualInterestRate, "Faiz oranı") : undefined;
      const next = await addInvestmentHolding({
        symbol,
        name: isCash ? query.trim() || `Nakit / Mevduat ${costCurrency}` : selected?.name,
        assetType: isCash ? "cash" : selected?.assetType ?? assetType,
        quantity: parsedQuantity,
        averageCost: parsedAverageCost,
        costCurrency,
        exchange: isCash ? undefined : selected?.exchange,
        micCode: isCash ? undefined : selected?.micCode,
        marketCurrency: isCash ? costCurrency : selected?.currency,
        annualInterestRate: parsedAnnualInterestRate
      });
      setPortfolio(next);
      setSelected(null);
      setQuery("");
      setQuantity("1");
      setAverageCost("");
      setAnnualInterestRate("");
      setMessage("Portfoye eklendi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Portfoye eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function removeHolding(id: string) {
    setBusy(true);
    try {
      setPortfolio(await deleteInvestmentHolding(id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pozisyon silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (!portfolio) {
    return (
      <View style={{ paddingTop: 80, alignItems: "center", gap: 8 }}>
        <ActivityIndicator color={p.accent} />
        <Text style={{ color: p.muted, fontSize: 12 }}>Portfoy yukleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: space[4] }}>
      <ScreenHeader eyebrow="Piyasa" title="Yatirim Portfoyu" subtitle="Hisse, doviz, altin, nakit ve mevduati tek toplamda takip et." />

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <View style={{ gap: 4, flex: 1 }}>
            <Eyebrow tone="muted">Toplam deger</Eyebrow>
            <Text style={{ color: p.ink, fontSize: 28, fontWeight: "900" }}>{formatTry(portfolio.totalMarketValueTry)}</Text>
          </View>
          <Chip label={sourceLabel} tone="accent" small />
        </View>
        <KV k="Maliyet" v={formatTry(portfolio.totalCostTry)} />
        <KV
          k={portfolio.hasMarketDataGap ? "Kar / zarar (fiyatli)" : "Kar / zarar"}
          v={`${portfolio.totalProfitLossTry >= 0 ? "+" : ""}${formatTry(portfolio.totalProfitLossTry)} (%${formatNumber(portfolio.totalProfitLossPercent)})`}
          vTone={portfolio.totalProfitLossTry >= 0 ? "accent" : "danger"}
        />
        <KV k="Gunluk faiz" v={formatTry(portfolio.totalDailyInterestTry)} vTone={portfolio.totalDailyInterestTry > 0 ? "accent" : undefined} />
        <KV k="Gun sonu toplam" v={formatTry(portfolio.projectedEndOfDayValueTry)} />
        {portfolio.warning ? <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>{portfolio.warning}</Text> : null}
        <Muted>Piyasa fiyatlari backend cache ile gunde bir yenilenir. Nakit ve mevduat pozisyonlari gunluk faiz projeksiyonuna dahil edilir.</Muted>
      </Card>

      {portfolio.allocation.length > 0 ? (
        <Card>
          <SectionTitle>Dagilim</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {portfolio.allocation.map((item) => (
              <View
                key={item.assetType}
                style={{
                  flexBasis: "47%",
                  flexGrow: 1,
                  borderColor: p.line,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: space[3],
                  gap: 4
                }}
              >
                <Text style={{ color: p.muted, fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
                <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>%{formatNumber(item.weight)}</Text>
                <Text style={{ color: p.muted, fontSize: 11 }}>{formatTry(item.valueTry)}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <PortfolioTwinPanel portfolio={portfolio} goals={goals} />

      <Card>
        <SectionTitle>Varlik Ekle</SectionTitle>
        <View
          style={{
            minHeight: 44,
            borderColor: p.line,
            borderWidth: 1,
            borderRadius: radius.md,
            backgroundColor: p.surface2,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            gap: 8
          }}
        >
          <Search color={p.muted} size={16} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setSelected(null);
            }}
            placeholder={isCash ? "Vadeli mevduat, vadesiz hesap" : "THYAO, XAU, USD/TRY"}
            placeholderTextColor={p.muted}
            autoCapitalize="characters"
            style={{ flex: 1, color: p.ink, fontSize: 14, paddingVertical: 10 }}
          />
        </View>

        {!isCash ? (
          <View style={{ gap: 8 }}>
          {results.slice(0, 5).map((item) => (
            <Pressable
              key={`${item.symbol}-${item.exchange ?? "none"}-${item.micCode ?? "none"}`}
              onPress={() => {
                setSelected(item);
                setQuery(item.symbol);
                setAssetType(item.assetType);
                setCostCurrency(item.currency === "USD" || item.currency === "EUR" ? item.currency : "TRY");
              }}
              android_ripple={{ color: p.line }}
              style={{
                borderColor: selected?.symbol === item.symbol ? p.accent : p.line,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: space[3],
                gap: 3,
                backgroundColor: selected?.symbol === item.symbol ? p.accentSoft : p.surface
              }}
            >
              <Text style={{ color: p.ink, fontWeight: "900", fontSize: 14 }}>{item.symbol}</Text>
              <Text style={{ color: p.muted, fontSize: 12 }} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={{ color: p.muted, fontSize: 11 }}>{[item.exchange, item.currency].filter(Boolean).join(" / ") || item.assetType}</Text>
            </Pressable>
          ))}
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={{ color: p.muted, fontSize: 12, fontWeight: "800" }}>Tur</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {assetTypes.map((item) => (
              <Choice
                key={item.value}
                label={item.label}
                active={assetType === item.value}
                onPress={() => {
                  setAssetType(item.value);
                  if (item.value === "cash") {
                    setSelected(null);
                    setResults([]);
                  }
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <NumberField label={isCash ? "Tutar" : "Adet"} value={quantity} onChangeText={setQuantity} />
          {isCash ? <NumberField label="Faiz %" value={annualInterestRate} onChangeText={setAnnualInterestRate} /> : <NumberField label="Alis" value={averageCost} onChangeText={setAverageCost} />}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: p.muted, fontSize: 12, fontWeight: "800" }}>{isCash ? "Para birimi" : "Maliyet para birimi"}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {currencies.map((currency) => (
              <Choice key={currency} label={currency} active={costCurrency === currency} onPress={() => setCostCurrency(currency)} />
            ))}
          </View>
        </View>

        <Btn label={busy ? "Ekleniyor" : "Ekle"} onPress={() => void addHolding()} disabled={busy} icon={<Plus color={p.surface} size={14} />} />
        {message ? <Text style={{ color: p.muted, fontSize: 12 }}>{message}</Text> : null}
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SectionTitle>Pozisyonlar</SectionTitle>
          <Chip label={`${portfolio.positions.length} varlik`} tone="neutral" small />
        </View>
        {portfolio.positions.map((position) => {
          const isUp = position.profitLossTry >= 0;
          return (
            <View
              key={position.id}
              style={{
                borderTopColor: p.line,
                borderTopWidth: 1,
                paddingTop: 12,
                gap: 10
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.ink, fontWeight: "900", fontSize: 15 }}>{position.symbol}</Text>
                  <Text style={{ color: p.muted, fontSize: 12 }} numberOfLines={1}>
                    {position.name}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void removeHolding(position.id)}
                  android_ripple={{ color: p.line }}
                  style={{ width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, borderColor: p.line, alignItems: "center", justifyContent: "center" }}
                >
                  <Trash2 color={p.muted} size={16} />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <MiniStat label="Adet" value={formatNumber(position.quantity)} />
                <MiniStat label="Son" value={position.isPriced ? `${formatNumber(position.quote.price)} ${position.quote.currency}` : "Alinamadi"} />
                <MiniStat label="Deger" value={position.isPriced ? formatTry(position.marketValueTry) : "-"} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {position.isPriced ? (
                  position.dailyInterestTry > 0 ? (
                    <TrendingUp color={p.accent} size={16} />
                  ) : isUp ? (
                    <TrendingUp color={p.accent} size={16} />
                  ) : (
                    <TrendingDown color={p.danger} size={16} />
                  )
                ) : null}
                <Text style={{ color: position.isPriced ? (isUp ? p.accent : p.danger) : p.muted, fontWeight: "900", fontSize: 13, flex: 1 }}>
                  {position.isPriced
                    ? position.dailyInterestTry > 0
                      ? `+${formatTry(position.dailyInterestTry)} gunluk faiz`
                      : `${isUp ? "+" : ""}${formatTry(position.profitLossTry)} (%${formatNumber(position.profitLossPercent)})`
                    : position.marketDataMessage ?? "Piyasa verisi alinamadi."}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function BankStatementCard({
  flow,
  loading,
  onPick,
  onConfirm,
  setFlow
}: {
  flow: StatementFlow;
  loading: boolean;
  onPick: () => void;
  onConfirm: () => void;
  setFlow: (flow: StatementFlow) => void;
}) {
  const p = usePalette();
  const previewItems = flow.phase === "preview" ? flow.data.items : [];
  const importableSelectedCount = flow.phase === "preview" ? countImportableSelected(flow.data, flow.selected, flow.skipDuplicates) : 0;
  const confirmDisabled = loading || importableSelectedCount === 0;

  function toggle(index: number) {
    if (flow.phase !== "preview") return;
    const selected = new Set(flow.selected);
    if (selected.has(index)) {
      selected.delete(index);
    } else {
      selected.add(index);
    }
    setFlow({ ...flow, selected });
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.md,
            backgroundColor: p.accentSoft,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {loading ? <ActivityIndicator color={p.accent} /> : <FileText color={p.accent} size={22} />}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Eyebrow>Ekstre</Eyebrow>
          <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>Banka ekstresi yükle</Text>
          <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
            PDF ekstreden harcama kalemlerini çıkar, seçtiklerini gider geçmişine işle.
          </Text>
        </View>
      </View>

      <Btn
        label={loading ? "Ekstre okunuyor" : "PDF seç"}
        onPress={onPick}
        disabled={loading}
        variant={flow.phase === "idle" ? "primary" : "secondary"}
        icon={<FileUp color={flow.phase === "idle" ? p.surface : p.ink} size={14} />}
      />

      {flow.phase === "preview" ? (
        <>
          <Divider />
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.ink, fontSize: 16, fontWeight: "900" }}>{flow.data.statementMonth} önizleme</Text>
              <Text style={{ color: p.muted, fontSize: 12 }}>{flow.selected.size} / {flow.data.items.length} kalem seçili</Text>
            </View>
            <Chip label={`%${Math.round(flow.data.avgConfidence * 100)} güven`} tone={flow.data.avgConfidence < 0.6 ? "warn" : "good"} small />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <StatementSummary label="Kalem" value={String(flow.data.items.length)} />
            <StatementSummary label="Toplam" value={`${flow.data.totalAmount.toLocaleString("tr-TR")} TL`} />
          </View>
          {flow.data.warnings.map((warning, index) => (
            <Text key={`${warning}-${index}`} style={{ color: p.warn, fontSize: 12, lineHeight: 17 }}>
              {warning}
            </Text>
          ))}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn label="Tümünü seç" variant="secondary" onPress={() => setFlow({ ...flow, selected: new Set(flow.data.items.map((item) => item.index)) })} />
            <Btn label="Temizle" variant="secondary" onPress={() => setFlow({ ...flow, selected: new Set() })} />
          </View>
          <Pressable
            onPress={() => setFlow({ ...flow, skipDuplicates: !flow.skipDuplicates })}
            style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
          >
            <CheckBox checked={flow.skipDuplicates} />
            <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>Yinelenenleri atla</Text>
          </Pressable>
          <View style={{ gap: 8 }}>
            {previewItems.map((item) => (
              <Pressable
                key={item.index}
                onPress={() => toggle(item.index)}
                style={{
                  borderColor: flow.selected.has(item.index) ? p.accent : p.line,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: 10,
                  backgroundColor: flow.selected.has(item.index) ? p.accentSoft : p.surface2,
                  gap: 6
                }}
              >
                <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                  <CheckBox checked={flow.selected.has(item.index)} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.ink, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>{item.merchant}</Text>
                    <Text style={{ color: p.muted, fontSize: 11 }}>{item.occurredAt} · {item.categoryName}</Text>
                  </View>
                  <Text style={{ color: p.ink, fontWeight: "900", fontSize: 13 }}>{item.amount.toLocaleString("tr-TR")} TL</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <Chip label={`%${Math.round(item.confidence * 100)} güven`} tone={item.confidence < 0.6 ? "warn" : "good"} small />
                  {item.existingTransactionId ? <Chip label="Mevcut işlem" tone="warn" small /> : null}
                </View>
              </Pressable>
            ))}
          </View>
          {confirmDisabled && !loading ? (
            <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
              {flow.selected.size ? "Seçilen kalemler mevcut işlemlerle eşleşiyor. Yinelenenleri atla kapatılmadan içe aktarılamaz." : "İçe aktarılacak en az bir kalem seç."}
            </Text>
          ) : null}
          <Btn label={loading ? "İşleniyor" : "Seçilenleri giderlere ekle"} onPress={onConfirm} disabled={confirmDisabled} />
        </>
      ) : null}

      {flow.phase === "confirmed" ? (
        <>
          <Divider />
          <StatementConfirmedContent
            result={flow.data}
            onReset={() => setFlow({ phase: "idle" })}
          />
        </>
      ) : null}
    </Card>
  );
}

type ReminderStatus = { phase: "saving" | "saved" | "error"; message?: string };

function StatementConfirmedContent({ result, onReset }: { result: StatementConfirmResult; onReset: () => void }) {
  const p = usePalette();
  const [activeTab, setActiveTab] = useState<"transactions" | "subscriptions">(
    result.recurringSubscriptions.length ? "subscriptions" : "transactions"
  );
  const [reminderDates, setReminderDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(result.recurringSubscriptions.map((subscription) => [subscription.id, subscription.nextEstimatedAt]))
  );
  const [reminderStatuses, setReminderStatuses] = useState<Record<string, ReminderStatus>>({});

  async function scheduleReminder(subscriptionId: string) {
    const subscription = result.recurringSubscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) return;
    const remindAt = reminderDates[subscriptionId] ?? subscription.nextEstimatedAt;
    setReminderStatuses((current) => ({ ...current, [subscriptionId]: { phase: "saving" } }));
    try {
      await createSubscriptionReminder({
        merchant: subscription.merchant,
        amount: subscription.amount,
        remindAt,
        note: `${result.statementMonth} ekstresinden tespit edildi`
      });
      setReminderStatuses((current) => ({ ...current, [subscriptionId]: { phase: "saved" } }));
    } catch (error) {
      setReminderStatuses((current) => ({
        ...current,
        [subscriptionId]: { phase: "error", message: toReminderErrorMessage(error) }
      }));
    }
  }

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CheckCircle2 color={p.good} size={17} />
        <Text style={{ color: p.good, fontSize: 13, fontWeight: "900" }}>
          {result.importedCount} harcama kalemi eklendi
        </Text>
      </View>
      <Text style={{ color: p.muted, fontSize: 12 }}>
        {result.duplicateCount ? `${result.duplicateCount} yinelenen kalem atlandı.` : "Ekstre harcama geçmişine işlendi."}
      </Text>

      <View style={{ flexDirection: "row", gap: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === "transactions" }}
          onPress={() => setActiveTab("transactions")}
          style={{
            flex: 1,
            minHeight: 38,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.md,
            backgroundColor: activeTab === "transactions" ? p.accent : p.surface2,
            borderColor: activeTab === "transactions" ? p.accent : p.line,
            borderWidth: 1
          }}
        >
          <Text style={{ color: activeTab === "transactions" ? p.onAccent : p.ink, fontWeight: "800", fontSize: 12 }}>
            Harcama kalemleri
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === "subscriptions" }}
          onPress={() => setActiveTab("subscriptions")}
          style={{
            flex: 1,
            minHeight: 38,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.md,
            backgroundColor: activeTab === "subscriptions" ? p.accent : p.surface2,
            borderColor: activeTab === "subscriptions" ? p.accent : p.line,
            borderWidth: 1
          }}
        >
          <Text style={{ color: activeTab === "subscriptions" ? p.onAccent : p.ink, fontWeight: "800", fontSize: 12 }}>
            Tekrar eden abonelikler
          </Text>
        </Pressable>
      </View>

      {activeTab === "transactions" ? (
        <View style={{ gap: 8 }}>
          {result.transactions.map((transaction) => (
            <View
              key={transaction.id}
              style={{
                borderColor: p.line,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: 10,
                backgroundColor: p.surface2,
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center"
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.ink, fontWeight: "900", fontSize: 13 }} numberOfLines={1}>{transaction.merchant}</Text>
                <Text style={{ color: p.muted, fontSize: 11 }} numberOfLines={1}>{transaction.categoryId}</Text>
              </View>
              <Text style={{ color: p.ink, fontWeight: "900", fontSize: 13 }}>{transaction.amount.toLocaleString("tr-TR")} TL</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {result.recurringSubscriptions.length ? (
            result.recurringSubscriptions.map((subscription) => {
              const status = reminderStatuses[subscription.id];
              const saving = status?.phase === "saving";
              const saved = status?.phase === "saved";
              const errored = status?.phase === "error";
              return (
                <View
                  key={subscription.id}
                  style={{
                    borderColor: p.line,
                    borderWidth: 1,
                    borderRadius: radius.md,
                    padding: 12,
                    backgroundColor: p.surface2,
                    gap: 8
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.ink, fontWeight: "900", fontSize: 14 }} numberOfLines={1}>{subscription.merchant}</Text>
                      <Text style={{ color: p.muted, fontSize: 11 }}>
                        {subscription.amount.toLocaleString("tr-TR")} TL · {subscription.occurrenceCount} tekrar · %{Math.round(subscription.confidence * 100)} güven
                      </Text>
                      <Text style={{ color: p.muted, fontSize: 11 }}>
                        Son yükleme: {subscription.lastChargedAt} · Tahmini sıradaki: {subscription.nextEstimatedAt}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Text style={{ color: p.muted, fontSize: 12, fontWeight: "800" }}>Hatırlat (YYYY-MM-DD)</Text>
                    <TextInput
                      value={reminderDates[subscription.id] ?? subscription.nextEstimatedAt}
                      onChangeText={(value) => setReminderDates((current) => ({ ...current, [subscription.id]: value }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={p.muted}
                      style={{
                        minHeight: 40,
                        flexGrow: 1,
                        flexBasis: 140,
                        borderColor: p.line,
                        borderWidth: 1,
                        borderRadius: radius.md,
                        paddingHorizontal: 12,
                        color: p.ink,
                        backgroundColor: p.surface,
                        fontSize: 13
                      }}
                    />
                  </View>
                  <Btn
                    label={saving ? "Kuruluyor" : saved ? "Hatırlatma kuruldu" : "Bu tarihte hatırlat"}
                    onPress={() => void scheduleReminder(subscription.id)}
                    disabled={saving || saved}
                    variant={saved ? "secondary" : "primary"}
                  />
                  {errored ? <Text style={{ color: p.danger, fontSize: 11, fontWeight: "800" }}>{status?.message}</Text> : null}
                </View>
              );
            })
          ) : (
            <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>Tekrar eden abonelik bulunamadı.</Text>
          )}
        </View>
      )}

      <Btn label="Yeni ekstre yükle" onPress={onReset} variant="secondary" icon={<X color={p.ink} size={14} />} />
    </>
  );
}

function toReminderErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.code ? `${error.code}: ${error.message}` : error.message;
  }
  return error instanceof Error ? error.message : "Hatırlatma kurulamadı.";
}

function countImportableSelected(data: StatementPreviewResult, selected: Set<number>, skipDuplicates: boolean) {
  return data.items.filter((item) => selected.has(item.index) && (!skipDuplicates || !item.existingTransactionId)).length;
}

function PortfolioTwinPanel({ portfolio, goals }: { portfolio: InvestmentPortfolioSummary; goals: Goal[] }) {
  const p = usePalette();
  const topAllocation = [...portfolio.allocation].sort((left, right) => right.weight - left.weight)[0];
  const cashWeight = portfolio.allocation.find((item) => item.assetType === "cash")?.weight ?? 0;
  const emergencyGoal = goals.find((goal) => /acil|emergency/i.test(goal.title));
  const shortTermGoalGap = goals
    .filter((goal) => daysUntil(goal.deadline) <= 180)
    .reduce((total, goal) => total + Math.max(0, goal.targetAmount - goal.currentAmount), 0);
  const riskNotes = [
    topAllocation && topAllocation.weight >= 70
      ? `${topAllocation.label} portföyün %${topAllocation.weight.toLocaleString("tr-TR")} kısmını oluşturuyor; yoğunlaşma riski izlenmeli.`
      : undefined,
    cashWeight < 10 && portfolio.totalMarketValueTry > 0
      ? "Nakit/mevduat oranı düşük; kısa vadeli hedefler için likidite tamponu kontrol edilmeli."
      : undefined,
    emergencyGoal && emergencyGoal.currentAmount < emergencyGoal.targetAmount * 0.5
      ? `Acil durum hedefi henüz %${Math.round((emergencyGoal.currentAmount / emergencyGoal.targetAmount) * 100)} seviyesinde; yüksek riskli varlık yoğunluğu varsa nakit tampon öncelikli izlenmeli.`
      : undefined,
    shortTermGoalGap > 0 && cashWeight < 25
      ? `Önümüzdeki 6 ay hedeflerinde ${formatTry(shortTermGoalGap)} açık var; kısa vadeli hedefler için nakit/mevduat oranı düşük kalabilir.`
      : undefined,
    portfolio.hasMarketDataGap
      ? `${portfolio.unpricedPositionCount} pozisyon için fiyat alınamadı; kar/zarar yalnızca fiyatlanan varlıklardan hesaplanıyor.`
      : undefined,
    portfolio.totalDailyInterestTry > 0
      ? `Mevduat/nakit günlük faiz projeksiyonu ${formatTry(portfolio.totalDailyInterestTry)}.`
      : undefined
  ].filter((note): note is string => Boolean(note));

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <SectionTitle>Portföy İkizi</SectionTitle>
        <Chip label={portfolio.hasMarketDataGap ? "Eksik veri var" : "Dağılım okunuyor"} tone={portfolio.hasMarketDataGap ? "warn" : "accent"} small />
      </View>
      {portfolio.positions.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <TwinFact label="En yoğun varlık sınıfı" value={topAllocation ? `${topAllocation.label} · %${topAllocation.weight.toLocaleString("tr-TR")}` : "Yok"} />
          <TwinFact label="Fiyatlanamayan maliyet" value={formatTry(portfolio.unpricedCostTry)} />
          <TwinFact label="Veri güveni" value={portfolio.hasMarketDataGap ? "Orta" : "Yüksek"} />
          <TwinFact label="Hedef uyumu" value={shortTermGoalGap > 0 ? `${formatTry(shortTermGoalGap)} kısa vade açığı` : "Kısa vade açık yok"} />
        </View>
      ) : (
        <View
          style={{
            borderColor: p.line,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: space[3],
            backgroundColor: p.surface2,
            gap: 4
          }}
        >
          <Text style={{ color: p.ink, fontWeight: "900", fontSize: 14 }}>Hedef uyumu beklemede</Text>
          <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
            {goals.length
              ? `${goals.length} finansal hedef var; pozisyon eklendiğinde likidite, yoğunlaşma ve kısa vade açığı birlikte okunacak.`
              : "Pozisyon ve hedef eklendiğinde dağılım riski, piyasa veri boşlukları ve hedef uyumu birlikte açıklanır."}
          </Text>
        </View>
      )}
      {riskNotes.length ? (
        <View style={{ gap: 6 }}>
          {riskNotes.map((note) => (
            <View key={note} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Text style={{ color: p.accent, fontWeight: "900", fontSize: 14 }}>•</Text>
              <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17, flex: 1 }}>{note}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function TwinFact({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View
      style={{
        flexBasis: "47%",
        flexGrow: 1,
        borderColor: p.line,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space[3],
        gap: 4,
        backgroundColor: p.surface2
      }}
    >
      <Text style={{ color: p.muted, fontSize: 11, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: p.ink, fontSize: 14, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function daysUntil(dateOnly: string) {
  const now = new Date();
  const date = new Date(`${dateOnly}T12:00:00.000Z`);
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: p.line }}
      style={{
        borderRadius: radius.md,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: active ? p.ink : p.surface2,
        borderColor: active ? p.ink : p.line,
        borderWidth: 1
      }}
    >
      <Text style={{ color: active ? p.surface : p.ink, fontSize: 12, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function NumberField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, gap: 7 }}>
      <Text style={{ color: p.muted, fontSize: 12, fontWeight: "800" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        style={{
          minHeight: 44,
          borderColor: p.line,
          borderWidth: 1,
          borderRadius: radius.md,
          backgroundColor: p.surface2,
          color: p.ink,
          paddingHorizontal: 12,
          fontSize: 14
        }}
      />
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, borderColor: p.line, borderWidth: 1, borderRadius: radius.md, padding: space[2], gap: 3 }}>
      <Text style={{ color: p.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: p.ink, fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StatementSummary({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: p.surface2, borderRadius: radius.md, padding: space[2], gap: 2 }}>
      <Text style={{ color: p.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: p.ink, fontSize: 15, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  const p = usePalette();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: checked ? p.accent : p.line,
        backgroundColor: checked ? p.accent : p.surface,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {checked ? <Text style={{ color: p.onAccent, fontWeight: "900", fontSize: 14 }}>✓</Text> : null}
    </View>
  );
}

function parseRequiredPositiveNumber(value: string, field: string) {
  const parsed = parseOptionalPositiveNumber(value, field);
  if (parsed === undefined) throw new Error(`${field} gerekli.`);
  return parsed;
}

function parseOptionalPositiveNumber(value: string, field: string) {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} pozitif sayı olmalı.`);
  return parsed;
}

function formatTry(value: number) {
  return `${formatNumber(value)} TL`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}

function normalizeFileUri(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

function formatStatementError(error: unknown, fallback: string): string {
  if (error instanceof StatementApiError) {
    return statementErrorMessage(error.code, error.message);
  }
  return error instanceof Error ? error.message : fallback;
}
