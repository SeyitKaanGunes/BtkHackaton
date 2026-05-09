import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Plus, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react-native";
import type { Currency, InvestmentAssetType, InvestmentPortfolioSummary, MarketSymbolResult } from "@fintwin/shared";
import { addInvestmentHolding, deleteInvestmentHolding, loadInvestmentPortfolio, searchInvestmentSymbols } from "../api";
import { Btn, Card, Chip, Eyebrow, KV, Muted, ScreenHeader, SectionTitle } from "../ui";
import { radius, space, usePalette } from "../theme";

const assetTypes: Array<{ value: InvestmentAssetType; label: string }> = [
  { value: "stock", label: "Hisse" },
  { value: "gold", label: "Altin" },
  { value: "commodity", label: "Emtia" },
  { value: "forex", label: "Doviz" },
  { value: "crypto", label: "Kripto" },
  { value: "fund", label: "Fon" },
  { value: "other", label: "Diger" }
];

const currencies: Currency[] = ["TRY", "USD", "EUR"];

export function PortfolioScreen() {
  const p = usePalette();
  const [portfolio, setPortfolio] = useState<InvestmentPortfolioSummary | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketSymbolResult[]>([]);
  const [selected, setSelected] = useState<MarketSymbolResult | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [averageCost, setAverageCost] = useState("");
  const [assetType, setAssetType] = useState<InvestmentAssetType>("stock");
  const [costCurrency, setCostCurrency] = useState<Currency>("TRY");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadInvestmentPortfolio().then(setPortfolio);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      void searchInvestmentSymbols(query).then(setResults);
    }, 260);
    return () => clearTimeout(handle);
  }, [query]);

  const sourceLabel = useMemo(() => {
    if (!portfolio) return "Twelve Data";
    return portfolio.positions.some((item) => item.quote.source === "fallback") ? "Twelve Data + fallback" : "Twelve Data";
  }, [portfolio]);

  async function addHolding() {
    const symbol = selected?.symbol ?? query.trim().toUpperCase();
    const parsedQuantity = parseNumber(quantity);
    if (!symbol || parsedQuantity <= 0) {
      setMessage("Sembol ve adet gerekli.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const next = await addInvestmentHolding({
        symbol,
        name: selected?.name,
        assetType: selected?.assetType ?? assetType,
        quantity: parsedQuantity,
        averageCost: parseNumber(averageCost),
        costCurrency,
        exchange: selected?.exchange,
        micCode: selected?.micCode,
        marketCurrency: selected?.currency
      });
      setPortfolio(next);
      setSelected(null);
      setQuery("");
      setQuantity("1");
      setAverageCost("");
      setMessage("Varlik eklendi.");
    } finally {
      setBusy(false);
    }
  }

  async function removeHolding(id: string) {
    setBusy(true);
    try {
      setPortfolio(await deleteInvestmentHolding(id));
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
      <ScreenHeader eyebrow="Piyasa" title="Yatirim Portfoyu" subtitle="Hisse, doviz, altin ve emtia varliklarini tek ekranda takip et." />

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
          k="Kar / zarar"
          v={`${portfolio.totalProfitLossTry >= 0 ? "+" : ""}${formatTry(portfolio.totalProfitLossTry)} (%${formatNumber(portfolio.totalProfitLossPercent)})`}
          vTone={portfolio.totalProfitLossTry >= 0 ? "accent" : "danger"}
        />
        <Muted>Fiyatlar backend cache ile gunde bir yenilenir. Bu portfoy finansal saglik skoruna dahil edilmez.</Muted>
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
            placeholder="THYAO, XAU, USD/TRY"
            placeholderTextColor={p.muted}
            autoCapitalize="characters"
            style={{ flex: 1, color: p.ink, fontSize: 14, paddingVertical: 10 }}
          />
        </View>

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

        <View style={{ gap: 8 }}>
          <Text style={{ color: p.muted, fontSize: 12, fontWeight: "800" }}>Tur</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {assetTypes.map((item) => (
              <Choice key={item.value} label={item.label} active={assetType === item.value} onPress={() => setAssetType(item.value)} />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <NumberField label="Adet" value={quantity} onChangeText={setQuantity} />
          <NumberField label="Alis" value={averageCost} onChangeText={setAverageCost} />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: p.muted, fontSize: 12, fontWeight: "800" }}>Maliyet para birimi</Text>
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
                <MiniStat label="Son" value={`${formatNumber(position.quote.price)} ${position.quote.currency}`} />
                <MiniStat label="Deger" value={formatTry(position.marketValueTry)} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {isUp ? <TrendingUp color={p.accent} size={16} /> : <TrendingDown color={p.danger} size={16} />}
                <Text style={{ color: isUp ? p.accent : p.danger, fontWeight: "900", fontSize: 13 }}>
                  {isUp ? "+" : ""}
                  {formatTry(position.profitLossTry)} (%{formatNumber(position.profitLossPercent)})
                </Text>
              </View>
            </View>
          );
        })}
      </Card>
    </View>
  );
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

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTry(value: number) {
  return `${formatNumber(value)} TL`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}
