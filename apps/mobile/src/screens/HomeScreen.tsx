import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Gauge as GaugeIcon,
  PiggyBank,
  Repeat,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards
} from "lucide-react-native";
import type {
  DashboardSummary,
  SpendingDna,
  SubscriptionLeak,
  WhatIfResponse
} from "@fintwin/shared";
import { Btn, Card, Chip, Eyebrow, Gauge, KV, ProgressBar, RiskBar, ScreenHeader, SectionTitle, Stat, StatGrid } from "../ui";
import { radius, space, usePalette } from "../theme";

type Props = {
  dashboard: DashboardSummary;
  dna: SpendingDna;
  leaks: SubscriptionLeak[];
  simulation: WhatIfResponse;
  onOpenWhatIf: () => void;
  onOpenSubs: () => void;
};

export function HomeScreen({ dashboard, dna, leaks, simulation, onOpenWhatIf, onOpenSubs }: Props) {
  const p = usePalette();
  const fmt = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} TL`;
  const dnaItems = dna.categories.slice(0, 4);
  const totalLeak = leaks.reduce((s, l) => s + l.monthlyImpact, 0);

  const goals = useMemo(
    () => [
      { id: "emergency", label: "Acil Durum Fonu", current: 32000, target: 100000, icon: <ShieldCheck color={p.accent} size={16} /> },
      { id: "vacation", label: "Yaz Tatili", current: 18000, target: 55000, icon: <Sparkles color={p.accent2} size={16} /> }
    ],
    [p]
  );

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: 4 }}>
        <Eyebrow>Pazartesi · 09 Mayıs</Eyebrow>
        <Text style={{ color: p.ink, fontSize: 26, lineHeight: 30, fontWeight: "900" }}>Merhaba Seyit.</Text>
        <Text style={{ color: p.muted, fontSize: 14, lineHeight: 20 }}>
          Teknoloji harcamaların bu ay güvenli limiti aştı. Birlikte sakin bir aksiyon planı hazırlayalım.
        </Text>
      </View>

      <Card>
        <View style={{ flexDirection: "row", gap: space[4], alignItems: "center" }}>
          <Gauge value={dashboard.financialHealthScore} size={108} label="sağlık" />
          <View style={{ flex: 1, gap: 6 }}>
            <Eyebrow tone="muted">Finansal Sağlık</Eyebrow>
            <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>Orta seviye</Text>
            <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
              Güvenli aralıkta kalman için 3 öneri hazırlandı. Onay bekliyor.
            </Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              <Chip label="3 öneri" tone="accent" small />
              <Chip label="2 risk" tone="warn" small />
            </View>
          </View>
        </View>
      </Card>

      <StatGrid>
        <Stat icon={<WalletCards color={p.accent} size={16} />} label="Gelir" value={fmt(dashboard.income)} />
        <Stat icon={<ReceiptText color={p.accent} size={16} />} label="Gider" value={fmt(dashboard.expenses)} />
        <Stat icon={<PiggyBank color={p.accent} size={16} />} label="Bakiye" value={fmt(dashboard.income - dashboard.expenses + 22937)} sub="serbest nakit" />
        <Stat icon={<TrendingUp color={p.accent} size={16} />} label="Tasarruf" value={`%${dashboard.savingsRate}`} sub="hedef %35" />
      </StatGrid>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SectionTitle>Spending DNA</SectionTitle>
          <Chip label="Bu ay" tone="neutral" small />
        </View>
        <RiskBar label="Genel risk" value={dna.overallRisk ?? 100} />
        <RiskBar label="Maaş sonrası refleks" value={100} />
        <RiskBar label="Gece / hafta sonu" value={69} />
        <RiskBar label="Kampanya hassasiyeti" value={60} />
        <RiskBar label="Tasarruf disiplini" value={59} />
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SectionTitle>Yüksek riskli kategoriler</SectionTitle>
          <Chip label={`${dnaItems.length} kategori`} tone="neutral" small />
        </View>
        {dnaItems.map((item) => (
          <RiskBar
            key={item.categoryId}
            label={item.categoryName}
            value={item.riskScore}
            amount={item.monthlySpend ? `${Math.round(item.monthlySpend).toLocaleString("tr-TR")} TL` : undefined}
          />
        ))}
      </Card>

      <View style={{ gap: space[3] }}>
        <SectionTitle>Risk uyarıları</SectionTitle>
        <Card style={{ borderColor: p.warn, backgroundColor: p.warnSoft }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <AlertTriangle color={p.warn} size={20} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: p.warn, fontWeight: "900", fontSize: 14 }}>Teknoloji kampanya riski</Text>
              <Text style={{ color: p.ink, fontSize: 13, lineHeight: 19 }}>
                Kampanya hassasiyetin %60. Önümüzdeki 72 saat içinde 9.800 TL teknoloji harcaması olası.
              </Text>
              <Pressable onPress={onOpenWhatIf} android_ripple={{ color: p.line }} style={{ alignSelf: "flex-start", marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: p.warn, fontWeight: "800", fontSize: 12 }}>What-if simülasyonu</Text>
                <ArrowRight color={p.warn} size={14} />
              </Pressable>
            </View>
          </View>
        </Card>
        <Card style={{ borderColor: p.danger, backgroundColor: p.dangerSoft }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Repeat color={p.danger} size={20} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: p.danger, fontWeight: "900", fontSize: 14 }}>Abonelik sızıntısı</Text>
              <Text style={{ color: p.ink, fontSize: 13, lineHeight: 19 }}>
                {leaks.length} sızıntı tespit edildi. Aylık {fmt(totalLeak)} geri kazanılabilir.
              </Text>
              <Pressable onPress={onOpenSubs} android_ripple={{ color: p.line }} style={{ alignSelf: "flex-start", marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: p.danger, fontWeight: "800", fontSize: 12 }}>Abonelik avcısını aç</Text>
                <ArrowRight color={p.danger} size={14} />
              </Pressable>
            </View>
          </View>
        </Card>
      </View>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SectionTitle>Hedefler</SectionTitle>
          <Target color={p.muted} size={16} />
        </View>
        {goals.map((g) => {
          const pct = Math.round((g.current / g.target) * 100);
          return (
            <View key={g.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  {g.icon}
                  <Text style={{ color: p.ink, fontWeight: "800", fontSize: 14 }}>{g.label}</Text>
                </View>
                <Text style={{ color: p.muted, fontSize: 12, fontWeight: "700" }}>%{pct}</Text>
              </View>
              <ProgressBar progress={pct} />
              <Text style={{ color: p.muted, fontSize: 11 }}>
                {fmt(g.current)} / {fmt(g.target)}
              </Text>
            </View>
          );
        })}
      </Card>

      <ActionCenter
        items={[
          {
            id: "credit",
            icon: <Bell color={p.accent} size={16} />,
            tag: "Hatırlatıcı",
            tagTone: "accent",
            title: "Kredi kartı ödeme hatırlatıcısı",
            body: "12 Mayıs son ödeme tarihi. 8.420 TL bakiye. Tek dokunuşla takvime ekleyelim mi?"
          },
          {
            id: "delay",
            icon: <Clock color={p.warn} size={16} />,
            tag: "Emotional Delay",
            tagTone: "warn",
            title: "Teknoloji alışverişini 24 saat ertele",
            body: "Geçmiş veriye göre 24 saat beklediğin alışverişlerin %62'sinden vazgeçmişsin."
          }
        ]}
      />

      <View style={{ height: space[5] }} />
    </View>
  );
}

type ActionItem = {
  id: string;
  icon: React.ReactNode;
  tag: string;
  tagTone: "accent" | "warn" | "danger" | "good" | "neutral";
  title: string;
  body: string;
};

function ActionCenter({ items }: { items: ActionItem[] }) {
  const p = usePalette();
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle>Finansal Aksiyon Merkezi</SectionTitle>
        <Chip label="Onay bekliyor" tone="warn" small />
      </View>
      <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>
        Her öneri taslaktır. Onaylamadan hiçbir işlem otomatik yapılmaz.
      </Text>
      {items.map((it) => (
        <View
          key={it.id}
          style={{
            borderColor: p.line,
            borderWidth: 1,
            borderRadius: radius.md,
            padding: space[3],
            gap: space[2],
            backgroundColor: p.surface2
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              {it.icon}
              <Text style={{ color: p.ink, fontWeight: "900", fontSize: 14 }}>{it.title}</Text>
            </View>
            <Chip label={it.tag} tone={it.tagTone} small />
          </View>
          <Text style={{ color: p.muted, fontSize: 13, lineHeight: 19 }}>{it.body}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            <View style={{ flex: 2 }}>
              <Btn label="Onayla" onPress={() => undefined} variant="primary" icon={<CheckCircle2 color={p.surface} size={14} />} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="Düzenle" onPress={() => undefined} variant="secondary" />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="Reddet" onPress={() => undefined} variant="ghost" />
            </View>
          </View>
        </View>
      ))}
    </Card>
  );
}
