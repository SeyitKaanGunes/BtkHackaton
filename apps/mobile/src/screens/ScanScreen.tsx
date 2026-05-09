import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { Bell, Camera, CheckCircle2, FileText, Image as ImageIcon, ReceiptText, ShieldCheck, X } from "lucide-react-native";
import type { ReceiptExpenseImportResult, StatementImportResult } from "@fintwin/shared";
import { createSubscriptionReminder, importReceiptExpense, importStatement } from "../api";
import { Btn, Card, Chip, Divider, Eyebrow, KV, ScreenHeader } from "../ui";
import { radius, space, usePalette } from "../theme";

export function ScanScreen({ onImported }: { onImported: () => void }) {
  const p = usePalette();
  const [mode, setMode] = useState<"receipt" | "statement">("receipt");
  const [receiptResult, setReceiptResult] = useState<ReceiptExpenseImportResult | null>(null);
  const [statementResult, setStatementResult] = useState<StatementImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function captureReceipt(source: "camera" | "library") {
    try {
      setLoading(true);
      const launcher = source === "camera" ? launchCamera : launchImageLibrary;
      const image = await launcher({ mediaType: "photo", includeBase64: true, quality: 0.8 });
      if (image.errorMessage) {
        Alert.alert("Görsel açılamadı", image.errorMessage);
        return;
      }
      if (!image.didCancel) {
        const asset = image.assets?.[0];
        if (mode === "receipt") {
          const next = await importReceiptExpense(asset?.base64 ?? undefined, asset?.type ?? undefined);
          setReceiptResult(next);
        } else {
          const next = await importStatement(asset?.base64 ?? undefined, asset?.type ?? undefined);
          setStatementResult(next);
        }
        onImported();
      }
    } catch (error) {
      Alert.alert("Belge işlenemedi", error instanceof Error ? error.message : "Agent belgeyi analiz edemedi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ gap: space[4] }}>
      <ScreenHeader
        eyebrow="Belge Agent'ları"
        title="Belgeyi agent'a okut."
        subtitle="Fiş tek gider olarak eklenir; ekstredeki aylık harcama kalemleri ve abonelikler ayrı ayrı çıkarılır."
      />

      <View style={{ flexDirection: "row", backgroundColor: p.surface2, borderRadius: radius.md, padding: 4, gap: 4 }}>
        {([
          { id: "receipt", label: "Fiş", icon: <ReceiptText size={14} color={mode === "receipt" ? p.ink : p.muted} /> },
          { id: "statement", label: "Ekstre", icon: <FileText size={14} color={mode === "statement" ? p.ink : p.muted} /> }
        ] as const).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setMode(t.id as "receipt" | "statement")}
            android_ripple={{ color: p.line }}
            style={{
              flex: 1,
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 10,
              borderRadius: radius.sm,
              backgroundColor: mode === t.id ? p.surface : "transparent"
            }}
          >
            {t.icon}
            <Text style={{ color: mode === t.id ? p.ink : p.muted, fontWeight: "800", fontSize: 13 }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <Card style={{ alignItems: "center", paddingVertical: space[6], gap: space[3], borderStyle: "dashed" }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 99,
            backgroundColor: p.accentSoft,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {loading ? <ActivityIndicator color={p.accent} size="large" /> : <Camera color={p.accent} size={32} />}
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={{ color: p.ink, fontSize: 16, fontWeight: "900" }}>
            {loading ? "Belge taranıyor…" : mode === "receipt" ? "Fiş veya fatura seç" : "Ekstre görseli yükle"}
          </Text>
          <Text style={{ color: p.muted, fontSize: 12, textAlign: "center", lineHeight: 17 }}>
            {loading
              ? mode === "receipt"
                ? "AI tutar, KDV, kategori ve ödeme yöntemini çıkarıyor."
                : "AI aylık harcama kalemlerini ve abonelikleri çıkarıyor."
              : "Kameradan çek veya galeriden yükle. Agent sonucu otomatik giderlere işler."}
          </Text>
        </View>
        {!loading ? (
          <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
            <View style={{ flex: 1 }}>
              <Btn label="Kamera" onPress={() => captureReceipt("camera")} variant="primary" icon={<Camera color={p.surface} size={14} />} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="Galeri" onPress={() => captureReceipt("library")} variant="secondary" icon={<ImageIcon color={p.ink} size={14} />} />
            </View>
          </View>
        ) : null}
      </Card>

      {mode === "receipt" && receiptResult ? <ReceiptResultCard result={receiptResult} onDismiss={() => setReceiptResult(null)} /> : null}
      {mode === "statement" && statementResult ? <StatementResultCard result={statementResult} onDismiss={() => setStatementResult(null)} onImported={onImported} /> : null}

      <Card style={{ backgroundColor: p.surface2 }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <ShieldCheck color={p.accent} size={18} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>Otomatik gider kaydı</Text>
            <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
              Fiş tek işlem olarak, ekstre kalemleri ayrı ayrı giderlere eklenir. Sonuç kartında kategori ve güven skorunu görebilirsin.
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ height: space[5] }} />
    </View>
  );
}

function ReceiptResultCard({ result, onDismiss }: { result: ReceiptExpenseImportResult; onDismiss: () => void }) {
  const p = usePalette();
  const r = result.receipt;
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Eyebrow>Receipt Agent</Eyebrow>
          <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>{r.merchant}</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <X color={p.muted} size={18} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CheckCircle2 color={p.good} size={16} />
        <Text style={{ color: p.good, fontWeight: "800", fontSize: 12 }}>Giderlere otomatik eklendi</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={{ color: p.muted, fontSize: 11 }}>Toplam</Text>
          <Text style={{ color: p.ink, fontSize: 28, fontWeight: "900" }}>
            {r.totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
          </Text>
        </View>
        <Chip label={`Güven %${Math.round(r.confidence * 100)}`} tone="good" />
      </View>
      <Divider />
      <KV k="KDV" v={`${r.taxAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`} />
      <KV k="Tarih" v={r.occurredAt} />
      <KV k="Kategori" v={r.categoryName} vTone="accent" />
      <KV k="Ödeme tipi" v={r.paymentMethod === "credit_card" ? "Kredi kartı" : r.paymentMethod} />
      <KV k="İşlem durumu" v={result.addedToExpenses ? "Kaydedildi" : "Beklemede"} vTone={result.addedToExpenses ? "accent" : "warn"} />
      {r.lineItems?.length ? (
        <>
          <Divider />
          <Text style={{ color: p.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Kalemler</Text>
          {r.lineItems.map((li, i) => (
            <View key={`${li.name}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: p.ink, fontSize: 13 }}>{li.name}</Text>
              <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{li.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</Text>
            </View>
          ))}
        </>
      ) : null}
      <Btn label="Yeni belge tara" onPress={onDismiss} variant="secondary" />
    </Card>
  );
}

function StatementResultCard({ result, onDismiss, onImported }: { result: StatementImportResult; onDismiss: () => void; onImported: () => void }) {
  const p = usePalette();
  const items = result.transactions.length ? result.transactions : result.items;
  const hasSubs = result.recurringSubscriptions?.length > 0;
  const [subMode, setSubMode] = useState<"items" | "subscriptions">(hasSubs ? "subscriptions" : "items");
  const [reminderDates, setReminderDates] = useState<Record<string, string>>(
    () => Object.fromEntries((result.recurringSubscriptions ?? []).map((s) => [s.id, s.nextEstimatedAt]))
  );
  const [scheduledId, setScheduledId] = useState<string | null>(null);

  async function scheduleReminder(subId: string) {
    const sub = result.recurringSubscriptions?.find((s) => s.id === subId);
    if (!sub) return;
    await createSubscriptionReminder({
      merchant: sub.merchant,
      amount: sub.amount,
      remindAt: reminderDates[sub.id] ?? sub.nextEstimatedAt,
      note: `${result.statementMonth} ekstresinden tespit edildi`
    });
    setScheduledId(sub.id);
    onImported();
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Eyebrow>Statement Agent</Eyebrow>
          <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>{result.statementMonth} ekstresi</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <X color={p.muted} size={18} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, backgroundColor: p.surface2, borderRadius: radius.md, padding: 10 }}>
          <Text style={{ color: p.muted, fontSize: 11 }}>Toplam</Text>
          <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>{result.totalAmount.toLocaleString("tr-TR")} TL</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: p.surface2, borderRadius: radius.md, padding: 10 }}>
          <Text style={{ color: p.muted, fontSize: 11 }}>Eklenen</Text>
          <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>{result.importedCount} kalem</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CheckCircle2 color={p.good} size={16} />
        <Text style={{ color: p.good, fontWeight: "800", fontSize: 12 }}>
          {result.importedCount} harcama kalemi giderlere eklendi
        </Text>
      </View>

      {hasSubs ? (
        <View style={{ flexDirection: "row", backgroundColor: p.surface2, borderRadius: radius.md, padding: 4, gap: 4 }}>
          {(["items", "subscriptions"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setSubMode(m)}
              style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.sm, backgroundColor: subMode === m ? p.surface : "transparent" }}
            >
              <Text style={{ color: subMode === m ? p.ink : p.muted, fontWeight: "800", fontSize: 12 }}>
                {m === "items" ? "Kalemler" : "Abonelikler"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Divider />

      {subMode === "items" ? (
        items.slice(0, 6).map((it, i) => (
          <View key={`${it.merchant}-${it.amount}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{it.merchant}</Text>
              <Text style={{ color: p.muted, fontSize: 11 }}>
                {it.occurredAt}{"categoryName" in it ? ` · ${it.categoryName}` : ""}
              </Text>
            </View>
            <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{it.amount.toLocaleString("tr-TR")} TL</Text>
          </View>
        ))
      ) : (
        (result.recurringSubscriptions ?? []).map((sub) => (
          <View key={sub.id} style={{ borderColor: p.line, borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 8, backgroundColor: p.surface2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: p.ink, fontWeight: "900", fontSize: 13 }}>{sub.merchant}</Text>
              <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{sub.amount.toLocaleString("tr-TR")} TL</Text>
            </View>
            <Text style={{ color: p.muted, fontSize: 11 }}>{sub.occurrenceCount} tekrar · önerilen {sub.nextEstimatedAt}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", borderColor: p.line, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, backgroundColor: p.surface }}>
              <Bell color={p.muted} size={13} />
              <TextInput
                value={reminderDates[sub.id] ?? sub.nextEstimatedAt}
                onChangeText={(v) => setReminderDates((d) => ({ ...d, [sub.id]: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={p.muted}
                style={{ flex: 1, color: p.ink, fontSize: 13, paddingVertical: 8, paddingHorizontal: 8 }}
              />
            </View>
            <Btn
              label={scheduledId === sub.id ? "Hatırlatma kuruldu" : "Bu tarihte hatırlat"}
              onPress={() => scheduleReminder(sub.id)}
              variant={scheduledId === sub.id ? "secondary" : "primary"}
            />
          </View>
        ))
      )}
    </Card>
  );
}
