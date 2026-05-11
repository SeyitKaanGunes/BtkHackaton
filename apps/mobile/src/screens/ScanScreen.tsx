import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import { Camera, CheckCircle2, Image as ImageIcon, ReceiptText, ShieldCheck, X } from "lucide-react-native";
import { receiptErrorMessage, type ReceiptExpenseImportResult } from "@fintwin/shared";
import { importReceiptExpense, ReceiptApiError } from "../api";
import { Btn, Card, Chip, Divider, Eyebrow, KV, ScreenHeader } from "../ui";
import { radius, space, usePalette } from "../theme";

export function ScanScreen({ onImported }: { onImported: () => void }) {
  const p = usePalette();
  const [receiptResult, setReceiptResult] = useState<ReceiptExpenseImportResult | null>(null);
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
        const next = await importReceiptExpense(asset?.base64 ?? undefined, asset?.type ?? undefined);
        setReceiptResult(next);
        onImported();
      }
    } catch (error) {
      Alert.alert("Belge işlenemedi", formatReceiptError(error, "Agent belgeyi analiz edemedi."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ gap: space[4] }}>
      <ScreenHeader
        eyebrow="Fiş Agent'ı"
        title="Fişi agent'a okut."
        subtitle="Fiş veya fatura tek gider olarak doğrulanır ve oturum kullanıcısının gider geçmişine eklenir."
      />

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
          {loading ? <ActivityIndicator color={p.accent} size="large" /> : <ReceiptText color={p.accent} size={32} />}
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={{ color: p.ink, fontSize: 16, fontWeight: "900" }}>{loading ? "Fiş taranıyor..." : "Fiş veya fatura seç"}</Text>
          <Text style={{ color: p.muted, fontSize: 12, textAlign: "center", lineHeight: 17 }}>
            {loading
              ? "AI tutar, KDV, tarih, kategori ve ödeme yöntemini çıkarıyor."
              : "Kameradan çek veya galeriden yükle. Ekstre PDF akışı portföy ekranındaki banka ekstresi kartındadır."}
          </Text>
        </View>
        {!loading ? (
          <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
            <View style={{ flex: 1 }}>
              <Btn label="Kamera" onPress={() => captureDocument("camera")} variant="primary" icon={<Camera color={p.surface} size={14} />} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="Galeri" onPress={() => captureDocument("library")} variant="secondary" icon={<ImageIcon color={p.ink} size={14} />} />
            </View>
          </View>
        ) : null}
      </Card>

      {receiptResult ? <ReceiptResultCard result={receiptResult} onDismiss={() => setReceiptResult(null)} /> : null}

      <Card style={{ backgroundColor: p.surface2 }}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <ShieldCheck color={p.accent} size={18} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>Otomatik gider kaydı</Text>
            <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
              Fiş tek işlem olarak kaydedilir. Banka ekstresi çok kalemli olduğu için portföy ekranındaki kontrol akışından geçirilir.
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
            <View key={`${li.name}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: p.ink, fontSize: 13, flex: 1 }}>{li.name}</Text>
              <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{li.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</Text>
            </View>
          ))}
        </>
      ) : null}
      <Btn label="Yeni belge tara" onPress={onDismiss} variant="secondary" />
    </Card>
  );
}

function formatReceiptError(error: unknown, fallback: string): string {
  if (error instanceof ReceiptApiError) {
    return receiptErrorMessage(error.code, error.message);
  }
  return error instanceof Error ? error.message : fallback;
}
