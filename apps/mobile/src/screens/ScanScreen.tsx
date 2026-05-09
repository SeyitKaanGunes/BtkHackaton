import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { Camera, FileText, Image as ImageIcon, ReceiptText, ShieldCheck, X } from "lucide-react-native";
import type { ReceiptExpenseImportResult, StatementImportResult } from "@fintwin/shared";
import { importReceiptExpense, importStatement } from "../api";
import { Btn, Card, Chip, Divider, Eyebrow, KV, ScreenHeader, SectionTitle } from "../ui";
import { radius, space, usePalette } from "../theme";

export function ScanScreen({ onImported }: { onImported: () => void }) {
  const p = usePalette();
  const [mode, setMode] = useState<"receipt" | "statement">("receipt");
  const [receiptResult, setReceiptResult] = useState<ReceiptExpenseImportResult | null>(null);
  const [statementResult, setStatementResult] = useState<StatementImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function captureReceipt(source: "camera" | "library") {
    setLoading(true);
    const launcher = source === "camera" ? launchCamera : launchImageLibrary;
    const image = await launcher({ mediaType: "photo", includeBase64: true, quality: 0.8 });
    if (image.errorMessage) Alert.alert("Görsel açılamadı", image.errorMessage);
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
    setLoading(false);
  }

  return (
    <View style={{ gap: space[4] }}>
      <ScreenHeader eyebrow="Belge Agent'ları" title="Fişi tara, gidere dönüştür." subtitle="Receipt ve Statement Agent kameradan veya galeriden okur, kategorize eder." />

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
              ? "AI tutar, KDV, kategori ve ödeme yöntemini çıkarıyor."
              : "Kameradan çek veya galeriden yükle. Tek dokunuşla giderlere eklenecek."}
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
      {mode === "statement" && statementResult ? <StatementResultCard result={statementResult} onDismiss={() => setStatementResult(null)} /> : null}

      <Card style={{ backgroundColor: p.surface2 }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <ShieldCheck color={p.accent} size={18} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>Veri taslak olarak gelir</Text>
            <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
              OCR çıktısı kaydetmeden önce doğrulanır. Sen onaylamadan otomatik işlem oluşmaz.
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
      <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
        <View style={{ flex: 2 }}>
          <Btn label="İşlem olarak kaydet" onPress={() => undefined} variant="primary" />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Düzenle" onPress={() => undefined} variant="secondary" />
        </View>
      </View>
    </Card>
  );
}

function StatementResultCard({ result, onDismiss }: { result: StatementImportResult; onDismiss: () => void }) {
  const p = usePalette();
  const items = result.transactions.length ? result.transactions : result.items;
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
      <Divider />
      {items.slice(0, 6).map((it, i) => (
        <View key={`${it.merchant}-${it.amount}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{it.merchant}</Text>
            <Text style={{ color: p.muted, fontSize: 11 }}>
              {it.occurredAt}{"categoryName" in it ? ` · ${it.categoryName}` : ""}
            </Text>
          </View>
          <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{it.amount.toLocaleString("tr-TR")} TL</Text>
        </View>
      ))}
    </Card>
  );
}
