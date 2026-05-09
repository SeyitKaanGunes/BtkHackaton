import { Pressable, Text, View } from "react-native";
import { ArrowLeft, Pause, Sparkles, X } from "lucide-react-native";
import type { SubscriptionLeak } from "@fintwin/shared";
import { Btn, Card, Chip, Eyebrow, ScreenHeader, SectionTitle } from "../ui";
import { radius, space, usePalette } from "../theme";

const ISSUE_TONE: Record<string, { label: string; tone: "warn" | "danger" | "accent" }> = {
  unused: { label: "Kullanılmıyor", tone: "warn" },
  price_increase: { label: "Fiyat artışı", tone: "accent" },
  duplicate: { label: "Mükerrer abonelik", tone: "danger" }
};

export function SubscriptionsScreen({ leaks, onBack }: { leaks: SubscriptionLeak[]; onBack: () => void }) {
  const p = usePalette();
  const total = leaks.reduce((s, l) => s + l.monthlyImpact, 0);
  const yearly = total * 12;
  const fmt = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} TL`;

  return (
    <View style={{ gap: space[4] }}>
      <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <ArrowLeft color={p.muted} size={18} />
        <Text style={{ color: p.muted, fontWeight: "700", fontSize: 13 }}>Dashboard</Text>
      </Pressable>
      <ScreenHeader eyebrow="Abonelik Avcısı" title="Sızıntıları durdur." subtitle="Kullanılmayan, mükerrer veya fiyatı artan abonelikleri tek ekranda gör." />

      <Card style={{ backgroundColor: p.accentSoft, borderColor: p.accent }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 99, backgroundColor: p.accent, alignItems: "center", justifyContent: "center" }}>
            <Sparkles color={p.onAccent} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.accent, fontWeight: "800", fontSize: 12 }}>Aylık potansiyel kazanç</Text>
            <Text style={{ color: p.ink, fontSize: 28, fontWeight: "900" }}>{fmt(total)}</Text>
            <Text style={{ color: p.muted, fontSize: 12 }}>Yıllık {fmt(yearly)} tasarruf</Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: space[3] }}>
        <SectionTitle>Sızıntı listesi</SectionTitle>
        {leaks.map((leak, i) => {
          const issue = ISSUE_TONE[leak.issue] ?? { label: leak.issue, tone: "warn" as const };
          return (
            <Card key={`${leak.subscriptionId}-${leak.issue}-${i}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Text style={{ color: p.ink, fontWeight: "900", fontSize: 16 }}>{leak.merchant}</Text>
                  </View>
                  <Chip label={issue.label} tone={issue.tone} small />
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: p.danger, fontWeight: "900", fontSize: 16 }}>-{fmt(leak.monthlyImpact)}</Text>
                  <Text style={{ color: p.muted, fontSize: 11 }}>her ay</Text>
                </View>
              </View>
              <Text style={{ color: p.muted, fontSize: 12, lineHeight: 18 }}>
                {recommendation(leak)}
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={{ flex: 1 }}>
                  <Btn label="İptal taslağı" onPress={() => undefined} variant="primary" icon={<X color={p.surface} size={14} />} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn label="Dondur" onPress={() => undefined} variant="secondary" icon={<Pause color={p.ink} size={14} />} />
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <View style={{ height: space[5] }} />
    </View>
  );
}

function recommendation(leak: SubscriptionLeak): string {
  if (leak.issue === "unused") return `Son 60 gündür kullanılmamış. İptal edersen ${Math.round(leak.monthlyImpact * 12).toLocaleString("tr-TR")} TL/yıl tasarruf.`;
  if (leak.issue === "price_increase") return `Fiyat son ay arttı. Alternatif paketle aynı içeriği daha ucuza alabilirsin.`;
  if (leak.issue === "duplicate") return `Aynı hizmet için iki ayrı abonelik tespit edildi. Birini kapatmak yeterli.`;
  return "Detaylı analiz için aboneliği incele.";
}
