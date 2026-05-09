import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ArrowLeft, Clock, Gauge as GaugeIcon, Pause, Play, ShieldCheck, ShoppingBag, Sparkles, TrendingDown } from "lucide-react-native";
import type { WhatIfResponse } from "@fintwin/shared";
import { Btn, Card, Chip, Eyebrow, KV, Muted, RiskBar, ScreenHeader, SectionTitle } from "../ui";
import { radius, space, usePalette } from "../theme";

type Tone = "good" | "warn" | "danger";
type Scenario = { id: string; label: string; tone: Tone; spend: number; balance: number; note: string };

export function WhatIfScreen({ simulation, onBack }: { simulation: WhatIfResponse; onBack: () => void }) {
  const p = usePalette();
  const [amount, setAmount] = useState("10000");
  const [category] = useState("Teknoloji");
  const [selected, setSelected] = useState<string>("balanced");
  const [delayActive, setDelayActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10 * 60);

  useEffect(() => {
    if (!delayActive) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [delayActive]);

  useEffect(() => {
    if (secondsLeft === 0 && delayActive) setDelayActive(false);
  }, [secondsLeft, delayActive]);

  const safeLimit = simulation.safeLimit ?? 3900;

  const scenarios: Scenario[] = useMemo(
    () =>
      simulation.cards?.length
        ? simulation.cards.slice(0, 3).map((c, i) => ({
            id: c.id ?? ["safe", "balanced", "risky"][i],
            label: c.label,
            tone: i === 0 ? "good" : i === 1 ? "warn" : "danger",
            spend: c.spendAmount,
            balance: c.monthEndBalance ?? 0,
            note: c.recommendation
          }))
        : [
            { id: "safe", label: "Güvenli", tone: "good", spend: 3900, balance: 33900, note: "Tasarruf hedefini koruyor." },
            { id: "balanced", label: "Dengeli", tone: "warn", spend: 7000, balance: 30800, note: "Sınırı zorluyor; alternatif fiyat öner." },
            { id: "risky", label: "Riskli", tone: "danger", spend: 10000, balance: 27800, note: "Acil fonu zayıflatır." }
          ],
    [simulation]
  );

  const fmt = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} TL`;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const delayProgress = ((10 * 60 - secondsLeft) / (10 * 60)) * 100;

  return (
    <View style={{ gap: space[4] }}>
      <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <ArrowLeft color={p.muted} size={18} />
        <Text style={{ color: p.muted, fontWeight: "700", fontSize: 13 }}>Dashboard</Text>
      </Pressable>
      <ScreenHeader eyebrow="What-If Simülasyonu" title="Bu harcama ay sonunu nasıl etkiler?" subtitle="Senaryolar bir tavsiye değil; finansal eğitim ve analiz amaçlıdır." />

      <Card>
        <SectionTitle>Senaryo gir</SectionTitle>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: p.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Tutar</Text>
            <View style={{ borderColor: p.line, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", backgroundColor: p.surface }}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                style={{ flex: 1, color: p.ink, fontSize: 18, fontWeight: "900", paddingVertical: 12 }}
              />
              <Text style={{ color: p.muted, fontWeight: "800" }}>TL</Text>
            </View>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: p.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Kategori</Text>
            <View style={{ borderColor: p.line, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", backgroundColor: p.surface, height: 46 }}>
              <ShoppingBag color={p.accent} size={16} />
              <Text style={{ color: p.ink, fontWeight: "800", marginLeft: 8 }}>{category}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <ShieldCheck color={p.accent} size={14} />
            <Text style={{ color: p.muted, fontSize: 12 }}>Güvenli limit</Text>
          </View>
          <Text style={{ color: p.accent, fontWeight: "900", fontSize: 16 }}>{fmt(safeLimit)}</Text>
        </View>
      </Card>

      <View style={{ gap: space[3] }}>
        <SectionTitle>Senaryo karşılaştırması</SectionTitle>
        {scenarios.map((s) => (
          <ScenarioCard key={s.id} scenario={s} selected={selected === s.id} onSelect={() => setSelected(s.id)} />
        ))}
      </View>

      <Card style={{ backgroundColor: p.accentSoft, borderColor: p.accent }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Clock color={p.accent} size={20} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.accent, fontWeight: "900", fontSize: 14 }}>Emotional Delay</Text>
            <Text style={{ color: p.ink, fontSize: 12, lineHeight: 17 }}>
              10 dakikalık sakin bekleme. Süre dolduğunda kararını tekrar gözden geçirebilirsin.
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "center", paddingVertical: space[2] }}>
          <Text style={{ color: p.ink, fontSize: 48, fontWeight: "900", letterSpacing: 1 }}>
            {mm}:{ss}
          </Text>
          <View style={{ width: "100%", height: 6, backgroundColor: p.surface, borderRadius: 99, overflow: "hidden", marginTop: 8 }}>
            <View style={{ height: "100%", width: `${delayProgress}%`, backgroundColor: p.accent }} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ flex: 1 }}>
            <Btn
              label={delayActive ? "Duraklat" : secondsLeft === 0 ? "Sıfırla" : "10 dakika beklet"}
              onPress={() => {
                if (secondsLeft === 0) {
                  setSecondsLeft(10 * 60);
                  setDelayActive(true);
                } else setDelayActive((d) => !d);
              }}
              variant="primary"
              icon={delayActive ? <Pause color={p.surface} size={14} /> : <Play color={p.surface} size={14} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Btn label="Alternatif fiyat" onPress={() => undefined} variant="ghost" />
          </View>
        </View>
        <Btn label="Aksiyon taslağı oluştur" onPress={() => undefined} variant="secondary" icon={<Sparkles color={p.ink} size={14} />} />
      </Card>

      <View style={{ height: space[5] }} />
    </View>
  );
}

function ScenarioCard({ scenario, selected, onSelect }: { scenario: Scenario; selected: boolean; onSelect: () => void }) {
  const p = usePalette();
  const toneMap = {
    good: { fg: p.accent, bg: p.accentSoft, label: "Güvenli" },
    warn: { fg: p.warn, bg: p.warnSoft, label: "Sınırda" },
    danger: { fg: p.danger, bg: p.dangerSoft, label: "Riskli" }
  } as const;
  const tone = toneMap[scenario.tone];
  const fmt = (n: number) => `${Math.round(n).toLocaleString("tr-TR")} TL`;
  return (
    <Pressable
      onPress={onSelect}
      android_ripple={{ color: p.line }}
      style={{
        borderColor: selected ? tone.fg : p.line,
        borderWidth: selected ? 2 : 1,
        borderRadius: radius.md,
        padding: space[3],
        backgroundColor: p.surface,
        gap: space[2]
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: tone.fg }} />
          <Text style={{ color: p.ink, fontWeight: "900", fontSize: 16 }}>{scenario.label}</Text>
        </View>
        <Chip label={tone.label} tone={scenario.tone === "good" ? "good" : scenario.tone === "warn" ? "warn" : "danger"} small />
      </View>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.muted, fontSize: 11 }}>Harcama</Text>
          <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>{fmt(scenario.spend)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.muted, fontSize: 11 }}>Ay sonu bakiye</Text>
          <Text style={{ color: tone.fg, fontSize: 18, fontWeight: "900" }}>{fmt(scenario.balance)}</Text>
        </View>
      </View>
      <Text style={{ color: p.muted, fontSize: 12, lineHeight: 17 }}>{scenario.note}</Text>
    </Pressable>
  );
}
