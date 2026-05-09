import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import {
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
  Building2,
  Calendar,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet
} from "lucide-react-native";
import type { BusinessDashboard, CollectionScore } from "@fintwin/shared";
import { Btn, Card, Chip, Divider, Eyebrow, KV, ProgressBar, ScreenHeader, SectionTitle, Stat, StatGrid } from "../ui";
import { radius, space, usePalette } from "../theme";

const UPCOMING = [
  { id: "salary", label: "Maaş ödemeleri", date: "10 Mayıs", amount: -68000, kind: "Personel" },
  { id: "rent", label: "Ofis kirası", date: "15 Mayıs", amount: -22000, kind: "Operasyon" },
  { id: "tax", label: "Vergi ödemesi", date: "20 Mayıs", amount: -41000, kind: "Vergi" },
  { id: "capex", label: "Yeni ekipman yatırımı", date: "28 Mayıs", amount: -85000, kind: "Capex" }
];

const RECEIVABLES = [
  { id: "northwind", label: "Northwind tahsilatı", date: "12 Mayıs", amount: 124000, status: "Onaylandı" },
  { id: "atlas", label: "Atlas tahsilatı", date: "22 Mayıs", amount: 88000, status: "Beklemede" }
];

export function BusinessScreen({ dashboard, scores }: { dashboard: BusinessDashboard; scores: CollectionScore[] }) {
  const p = usePalette();
  const fmt = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} TL`;
  const [simulateAmount, setSimulateAmount] = useState("85000");
  const sim = Number(simulateAmount.replace(/\D/g, "")) || 0;
  const cashAfter = dashboard.cashBalance - sim;
  const liquidityTone = cashAfter < 100000 ? "danger" : cashAfter < 200000 ? "warn" : "good";

  const riskTone = useMemo(() => (dashboard.liquidityRisk === "low" ? "good" : dashboard.liquidityRisk === "medium" ? "warn" : "danger"), [dashboard.liquidityRisk]);
  const riskLabel = dashboard.liquidityRisk === "low" ? "Düşük risk" : dashboard.liquidityRisk === "medium" ? "Orta risk" : "Yüksek risk";

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: p.ink, alignItems: "center", justifyContent: "center" }}>
            <BriefcaseBusiness color={p.surface} size={16} />
          </View>
          <Eyebrow>AI CFO Lite · KOBİ</Eyebrow>
        </View>
        <Text style={{ color: p.ink, fontSize: 26, lineHeight: 30, fontWeight: "900" }}>Nakit akışını yönet.</Text>
        <Text style={{ color: p.muted, fontSize: 13, lineHeight: 19 }}>
          Kişisel finanstan ayrı bir alan. Tahsilatları, ödemeleri ve likidite riskini tek bakışta gör.
        </Text>
      </View>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ color: p.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Kasa</Text>
            <Text style={{ color: p.ink, fontSize: 32, fontWeight: "900", marginTop: 4 }}>{fmt(dashboard.cashBalance)}</Text>
          </View>
          <Chip label={riskLabel} tone={riskTone} />
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle>Nakit akışı projeksiyonu</SectionTitle>
        <ProjectionRow label="30 gün" value={dashboard.projected30Days} tone="good" />
        <ProjectionRow label="60 gün" value={dashboard.projected60Days} tone="good" />
        <ProjectionRow label="90 gün" value={dashboard.projected90Days} tone="warn" />
      </View>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SectionTitle>Yaklaşan ödemeler</SectionTitle>
          <Calendar color={p.muted} size={16} />
        </View>
        {UPCOMING.map((u, i) => (
          <View key={u.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopColor: p.line, borderTopWidth: i === 0 ? 0 : 1 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.ink, fontWeight: "800", fontSize: 14 }}>{u.label}</Text>
              <Text style={{ color: p.muted, fontSize: 11 }}>
                {u.date} · {u.kind}
              </Text>
            </View>
            <Text style={{ color: p.danger, fontWeight: "900", fontSize: 14 }}>{fmt(u.amount)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SectionTitle>Beklenen tahsilatlar</SectionTitle>
          <Banknote color={p.muted} size={16} />
        </View>
        {RECEIVABLES.map((r, i) => (
          <View key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopColor: p.line, borderTopWidth: i === 0 ? 0 : 1 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.ink, fontWeight: "800", fontSize: 14 }}>{r.label}</Text>
              <Text style={{ color: p.muted, fontSize: 11 }}>
                {r.date} · {r.status}
              </Text>
            </View>
            <Text style={{ color: p.accent, fontWeight: "900", fontSize: 14 }}>+{fmt(r.amount)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SectionTitle>Tahsilat skorları</SectionTitle>
          <Building2 color={p.muted} size={16} />
        </View>
        {scores.map((s) => (
          <CollectionRow key={s.customerId} score={s} />
        ))}
      </Card>

      <Card style={{ backgroundColor: p.surface2 }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <ShieldCheck color={p.accent} size={18} />
          <SectionTitle>Kararı simüle et</SectionTitle>
        </View>
        <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
          Yeni bir yatırım, ödeme veya tahsilat tutarı gir. AI CFO 30/60/90 gün etkisini taslak olarak hesaplar.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", borderColor: p.line, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, backgroundColor: p.surface }}>
          <Wallet color={p.muted} size={16} />
          <TextInput
            value={simulateAmount}
            onChangeText={setSimulateAmount}
            keyboardType="numeric"
            style={{ flex: 1, color: p.ink, fontSize: 18, fontWeight: "900", paddingVertical: 12, paddingHorizontal: 8 }}
          />
          <Text style={{ color: p.muted, fontWeight: "800" }}>TL</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: p.surface, borderColor: p.line, borderWidth: 1, borderRadius: radius.md, padding: 10 }}>
            <Text style={{ color: p.muted, fontSize: 11 }}>Yatırım sonrası kasa</Text>
            <Text style={{ color: liquidityTone === "danger" ? p.danger : liquidityTone === "warn" ? p.warn : p.accent, fontSize: 18, fontWeight: "900" }}>{fmt(cashAfter)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: p.surface, borderColor: p.line, borderWidth: 1, borderRadius: radius.md, padding: 10 }}>
            <Text style={{ color: p.muted, fontSize: 11 }}>30 gün etki</Text>
            <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>{fmt(dashboard.projected30Days - sim)}</Text>
          </View>
        </View>
        <Btn label="Aksiyon taslağı oluştur" onPress={() => undefined} variant="primary" />
      </Card>

      <View style={{ height: space[5] }} />
    </View>
  );
}

function ProjectionRow({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "danger" }) {
  const p = usePalette();
  const c = tone === "good" ? p.accent : tone === "warn" ? p.warn : p.danger;
  const pct = Math.max(8, Math.min(100, Math.round(value / 3000)));
  const fmt = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} TL`;
  return (
    <View style={{ backgroundColor: p.surface, borderColor: p.line, borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: p.ink, fontWeight: "800", fontSize: 13 }}>{label} projeksiyon</Text>
        <Text style={{ color: c, fontWeight: "900", fontSize: 14 }}>{fmt(value)}</Text>
      </View>
      <ProgressBar progress={pct} tone={tone === "good" ? "accent" : tone === "warn" ? "warn" : "danger"} />
    </View>
  );
}

function CollectionRow({ score }: { score: CollectionScore }) {
  const p = usePalette();
  const tone = score.score < 25 ? "danger" : score.score < 50 ? "warn" : "good";
  const fg = tone === "danger" ? p.danger : tone === "warn" ? p.warn : p.accent;
  const label = tone === "danger" ? "critical" : tone === "warn" ? "high" : "ok";
  const NAMES: Record<string, string> = { "cus-2": "Atlas Perakende", "cus-3": "Mavi Lojistik" };
  return (
    <View style={{ paddingVertical: 10, borderTopColor: p.line, borderTopWidth: 1, gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: p.ink, fontWeight: "800", fontSize: 14 }}>{NAMES[score.customerId] ?? score.customerId}</Text>
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Chip label={label} tone={tone === "good" ? "good" : tone === "warn" ? "warn" : "danger"} small />
          <Text style={{ color: fg, fontWeight: "900", fontSize: 14 }}>{score.score}/100</Text>
        </View>
      </View>
      <View style={{ height: 6, backgroundColor: p.surface2, borderRadius: 99, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${Math.max(4, score.score)}%`, backgroundColor: fg }} />
      </View>
    </View>
  );
}
