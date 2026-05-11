import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import DocumentPicker from "react-native-document-picker";
import * as RNFS from "react-native-fs";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { Bell, Camera, CheckCircle2, FileText, FileUp, Image as ImageIcon, ReceiptText, ShieldCheck, X } from "lucide-react-native";
import { receiptErrorMessage, statementErrorMessage, type ReceiptExpenseImportResult, type StatementConfirmResult, type StatementPreviewResult } from "@fintwin/shared";
import { confirmStatementImport, createSubscriptionReminder, importReceiptExpense, importStatementPreview, ReceiptApiError, StatementApiError } from "../api";
import { Btn, Card, Chip, Divider, Eyebrow, KV, ScreenHeader } from "../ui";
import { radius, space, usePalette } from "../theme";

type StatementFlow =
  | { phase: "idle" }
  | { phase: "preview"; data: StatementPreviewResult; selected: Set<number>; skipDuplicates: boolean }
  | { phase: "confirmed"; data: StatementConfirmResult };

export function ScanScreen({ onImported, embedded = false }: { onImported: () => void; embedded?: boolean }) {
  const p = usePalette();
  const [mode, setMode] = useState<"receipt" | "statement">("receipt");
  const [receiptResult, setReceiptResult] = useState<ReceiptExpenseImportResult | null>(null);
  const [statementFlow, setStatementFlow] = useState<StatementFlow>({ phase: "idle" });
  const [loading, setLoading] = useState(false);

  async function captureDocument(source: "camera" | "library") {
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
          onImported();
        } else {
          await previewStatement(asset?.base64 ?? "", asset?.type ?? "image/jpeg", asset?.fileName);
        }
      }
    } catch (error) {
      Alert.alert("Belge işlenemedi", formatDocumentError(error, "Agent belgeyi analiz edemedi."));
    } finally {
      setLoading(false);
    }
  }

  async function pickStatementPdf() {
    try {
      setLoading(true);
      const file = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.pdf], copyTo: "cachesDirectory" });
      const sourceUri = file.fileCopyUri ?? file.uri;
      const path = normalizeFileUri(sourceUri);
      const base64 = await RNFS.readFile(path, "base64");
      await previewStatement(base64, file.type ?? "application/pdf", file.name ?? "ekstre.pdf");
    } catch (error) {
      if (DocumentPicker.isCancel(error)) return;
      Alert.alert("PDF seçilemedi", formatStatementError(error, "PDF dosyası okunamadı."));
    } finally {
      setLoading(false);
    }
  }

  async function previewStatement(fileBase64: string, mimeType: string, fileName?: string | null) {
    const data = await importStatementPreview(fileBase64, mimeType, fileName ?? undefined);
    setStatementFlow({
      phase: "preview",
      data,
      selected: new Set(data.items.filter((item) => !item.existingTransactionId).map((item) => item.index)),
      skipDuplicates: true
    });
  }

  async function confirmStatement() {
    if (statementFlow.phase !== "preview") return;
    try {
      setLoading(true);
      const result = await confirmStatementImport(statementFlow.data.documentId, [...statementFlow.selected], statementFlow.skipDuplicates);
      setStatementFlow({ phase: "confirmed", data: result });
      onImported();
    } catch (error) {
      Alert.alert("Belge işlenemedi", formatStatementError(error, "Ekstre içe aktarılamadı."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ gap: space[4] }}>
      {embedded ? (
        <Card style={{ backgroundColor: p.surface2 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <FileText color={p.accent} size={18} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: p.ink, fontWeight: "900", fontSize: 15 }}>Belge ve ekstre yükle</Text>
              <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
                Fişleri giderlere, banka ekstresi kalemlerini onaydan sonra işlem geçmişine ekle.
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <ScreenHeader
          eyebrow="Belge Agent'ları"
          title="Belgeyi agent'a okut."
          subtitle="Fiş tek gider olarak eklenir; ekstre kalemleri önizleme sonrası seçilerek giderlere aktarılır."
        />
      )}

      <View style={{ flexDirection: "row", backgroundColor: p.surface2, borderRadius: radius.md, padding: 4, gap: 4 }}>
        {([
          { id: "receipt", label: "Fiş", icon: <ReceiptText size={14} color={mode === "receipt" ? p.ink : p.muted} /> },
          { id: "statement", label: "Ekstre", icon: <FileText size={14} color={mode === "statement" ? p.ink : p.muted} /> }
        ] as const).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setMode(t.id)}
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
            {loading ? "Belge taranıyor..." : mode === "receipt" ? "Fiş veya fatura seç" : "Banka ekstresi yükle"}
          </Text>
          <Text style={{ color: p.muted, fontSize: 12, textAlign: "center", lineHeight: 17 }}>
            {loading
              ? mode === "receipt"
                ? "AI tutar, KDV, kategori ve ödeme yöntemini çıkarıyor."
                : "AI harcama kalemlerini önizlemeye hazırlıyor."
              : mode === "receipt"
                ? "Kameradan çek veya galeriden yükle. Agent sonucu otomatik giderlere işler."
                : "Kameradan çek, galeriden görsel seç veya PDF yükle; kalemleri onayladıktan sonra giderlere ekle."}
          </Text>
        </View>
        {!loading ? (
          <View style={{ gap: 8, width: "100%" }}>
            <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
              <View style={{ flex: 1 }}>
                <Btn label="Kamera" onPress={() => captureDocument("camera")} variant="primary" icon={<Camera color={p.surface} size={14} />} />
              </View>
              <View style={{ flex: 1 }}>
                <Btn label="Galeri" onPress={() => captureDocument("library")} variant="secondary" icon={<ImageIcon color={p.ink} size={14} />} />
              </View>
            </View>
            {mode === "statement" ? (
              <Btn label="PDF seç" onPress={pickStatementPdf} variant="secondary" icon={<FileUp color={p.ink} size={14} />} />
            ) : null}
          </View>
        ) : null}
      </Card>

      {mode === "receipt" && receiptResult ? <ReceiptResultCard result={receiptResult} onDismiss={() => setReceiptResult(null)} /> : null}
      {mode === "statement" && statementFlow.phase === "preview" ? (
        <StatementPreviewCard flow={statementFlow} setFlow={setStatementFlow} onConfirm={confirmStatement} />
      ) : null}
      {mode === "statement" && statementFlow.phase === "confirmed" ? (
        <StatementConfirmedCard result={statementFlow.data} onDismiss={() => setStatementFlow({ phase: "idle" })} onImported={onImported} />
      ) : null}

      <Card style={{ backgroundColor: p.surface2 }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <ShieldCheck color={p.accent} size={18} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>Otomatik gider kaydı</Text>
            <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
              Fiş tek işlem olarak, ekstre kalemleri ise kontrol ekranından sonra ayrı ayrı giderlere eklenir.
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ height: embedded ? 0 : space[5] }} />
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

function StatementPreviewCard({
  flow,
  setFlow,
  onConfirm
}: {
  flow: Extract<StatementFlow, { phase: "preview" }>;
  setFlow: (flow: StatementFlow) => void;
  onConfirm: () => void;
}) {
  const p = usePalette();

  function toggle(index: number) {
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
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Eyebrow>Statement Agent</Eyebrow>
          <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>{flow.data.statementMonth} önizleme</Text>
        </View>
        <Chip label={`Güven %${Math.round(flow.data.avgConfidence * 100)}`} tone={flow.data.avgConfidence < 0.6 ? "warn" : "good"} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <SummaryBox label="Kalem" value={String(flow.data.items.length)} />
        <SummaryBox label="Toplam" value={`${flow.data.totalAmount.toLocaleString("tr-TR")} TL`} />
      </View>
      {flow.data.warnings.length ? (
        <View style={{ backgroundColor: p.warnSoft, borderColor: p.warn, borderWidth: 1, borderRadius: radius.md, padding: 10, gap: 4 }}>
          {flow.data.warnings.map((warning, index) => (
            <Text key={`${warning}-${index}`} style={{ color: p.warn, fontSize: 12 }}>
              {warning}
            </Text>
          ))}
        </View>
      ) : null}
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
      <Divider />
      {flow.data.items.map((item) => (
        <Pressable
          key={item.index}
          onPress={() => toggle(item.index)}
          style={{
            borderColor: item.confidence < 0.6 ? p.danger : p.line,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: 10,
            gap: 6,
            backgroundColor: item.confidence < 0.6 ? p.dangerSoft : p.surface2
          }}
        >
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <CheckBox checked={flow.selected.has(item.index)} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.ink, fontWeight: "900", fontSize: 13 }}>{item.merchant}</Text>
              <Text style={{ color: p.muted, fontSize: 11 }}>
                {item.occurredAt} · {item.categoryName}
              </Text>
            </View>
            <Text style={{ color: p.ink, fontWeight: "900", fontSize: 13 }}>{item.amount.toLocaleString("tr-TR")} TL</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Chip label={`%${Math.round(item.confidence * 100)} güven`} tone={item.confidence < 0.6 ? "warn" : "good"} small />
            {item.existingTransactionId ? <Chip label="Mevcut işlem" tone="warn" small /> : null}
          </View>
        </Pressable>
      ))}
      <Btn label="Onayla ve içe aktar" onPress={onConfirm} disabled={!flow.selected.size} variant="primary" />
    </Card>
  );
}

function StatementConfirmedCard({ result, onDismiss, onImported }: { result: StatementConfirmResult; onDismiss: () => void; onImported: () => void }) {
  const p = usePalette();
  const hasSubs = result.recurringSubscriptions.length > 0;
  const [subMode, setSubMode] = useState<"items" | "subscriptions">(hasSubs ? "subscriptions" : "items");
  const [reminderDates, setReminderDates] = useState<Record<string, string>>(
    () => Object.fromEntries(result.recurringSubscriptions.map((s) => [s.id, s.nextEstimatedAt]))
  );
  const [scheduledId, setScheduledId] = useState<string | null>(null);

  async function scheduleReminder(subId: string) {
    const sub = result.recurringSubscriptions.find((s) => s.id === subId);
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
        <SummaryBox label="Eklenen" value={`${result.importedCount} kalem`} />
        <SummaryBox label="Yinelenen" value={String(result.duplicateCount)} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CheckCircle2 color={p.good} size={16} />
        <Text style={{ color: p.good, fontWeight: "800", fontSize: 12 }}>{result.importedCount} harcama kalemi giderlere eklendi</Text>
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
        result.transactions.slice(0, 8).map((it) => (
          <View key={it.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{it.merchant}</Text>
              <Text style={{ color: p.muted, fontSize: 11 }}>{it.occurredAt.slice(0, 10)}</Text>
            </View>
            <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{it.amount.toLocaleString("tr-TR")} TL</Text>
          </View>
        ))
      ) : (
        result.recurringSubscriptions.map((sub) => (
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

function SummaryBox({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: p.surface2, borderRadius: radius.md, padding: 10 }}>
      <Text style={{ color: p.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>{value}</Text>
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

function normalizeFileUri(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

function formatStatementError(error: unknown, fallback: string): string {
  if (error instanceof StatementApiError) {
    return statementErrorMessage(error.code, error.message);
  }
  return error instanceof Error ? error.message : fallback;
}

function formatDocumentError(error: unknown, fallback: string): string {
  if (error instanceof ReceiptApiError) {
    return receiptErrorMessage(error.code, error.message);
  }
  return formatStatementError(error, fallback);
}
