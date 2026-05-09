import { useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { palettes, radius, space, type ThemePalette, usePalette } from "./theme";

// Re-export light palette as `palette` for backwards compatibility with older imports.
export const palette = palettes.light;

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[{ backgroundColor: p.surface, borderColor: p.line, borderWidth: 1, borderRadius: radius.md, padding: space[4], gap: space[3] }, style]}>
      {children}
    </View>
  );
}

// Backwards-compat alias for the original `Panel` component used in App.tsx.
export const Panel = Card;

export function SectionTitle({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={{ color: p.ink, fontSize: 18, fontWeight: "900" }}>{children}</Text>;
}

export function Eyebrow({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "warn" | "danger" | "muted" }) {
  const p = usePalette();
  const color = tone === "warn" ? p.warn : tone === "danger" ? p.danger : tone === "muted" ? p.muted : p.accent;
  return <Text style={{ color, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <Text style={[{ color: p.muted, fontSize: 13, lineHeight: 19 }, style as object]}>{children}</Text>;
}

export function Stat({ label, value, icon, sub }: { label: string; value: string; icon?: ReactNode; sub?: string }) {
  const p = usePalette();
  return (
    <View
      style={{
        flexBasis: "48%",
        flexGrow: 1,
        minHeight: 104,
        backgroundColor: p.surface,
        borderColor: p.line,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space[3],
        justifyContent: "space-between",
        gap: space[2]
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        {icon}
        <Text style={{ color: p.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      </View>
      <Text style={{ color: p.ink, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      {sub ? <Text style={{ color: p.muted, fontSize: 11 }}>{sub}</Text> : null}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{children}</View>;
}

export function Chip({ label, tone = "neutral", small }: { label: string; tone?: "neutral" | "accent" | "warn" | "danger" | "good"; small?: boolean }) {
  const p = usePalette();
  const map: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: p.surface2, fg: p.ink },
    accent: { bg: p.accentSoft, fg: p.accent },
    warn: { bg: p.warnSoft, fg: p.warn },
    danger: { bg: p.dangerSoft, fg: p.danger },
    good: { bg: p.goodSoft, fg: p.good }
  };
  const c = map[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: small ? 8 : 10, paddingVertical: small ? 3 : 5, alignSelf: "flex-start" }}>
      <Text style={{ color: c.fg, fontSize: small ? 10 : 11, fontWeight: "800", letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

export function Btn({
  label,
  onPress,
  variant = "primary",
  disabled,
  icon
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const p = usePalette();
  const styles = useMemo(() => {
    const base = { borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center" as const, flexDirection: "row" as const, justifyContent: "center" as const, gap: 8 };
    if (variant === "primary") return { wrap: { ...base, backgroundColor: p.ink }, text: { color: p.surface, fontWeight: "900" as const } };
    if (variant === "danger") return { wrap: { ...base, backgroundColor: p.danger }, text: { color: "#FFF", fontWeight: "900" as const } };
    if (variant === "ghost") return { wrap: { ...base, backgroundColor: "transparent", borderColor: p.line, borderWidth: 1 }, text: { color: p.ink, fontWeight: "800" as const } };
    return { wrap: { ...base, backgroundColor: p.surface2, borderColor: p.line, borderWidth: 1 }, text: { color: p.ink, fontWeight: "800" as const } };
  }, [variant, p]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: p.line }}
      style={({ pressed }) => [styles.wrap, disabled && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
    >
      {icon}
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

// Backwards-compat: original API shape used by App.tsx.
export function PillButton({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: p.line }}
      style={{ flex: 1, borderRadius: radius.md, paddingVertical: 10, alignItems: "center", backgroundColor: active ? p.surface : "transparent" }}
    >
      <Text style={{ color: active ? p.ink : p.muted, fontWeight: "800", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function riskColor(p: ThemePalette, value: number) {
  if (value >= 80) return p.danger;
  if (value >= 60) return p.warn;
  return p.accent;
}

export function RiskBar({ label, value, amount }: { label: string; value: number; amount?: string }) {
  const p = usePalette();
  const fillColor = riskColor(p, value);
  return (
    <View style={{ gap: 7 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: p.ink, fontWeight: "700" }}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          {amount ? <Text style={{ color: p.muted, fontSize: 12 }}>{amount}</Text> : null}
          <Text style={{ color: fillColor, fontWeight: "800" }}>{value}/100</Text>
        </View>
      </View>
      <View style={{ height: 9, backgroundColor: p.surface2, borderRadius: radius.pill, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${Math.max(4, Math.min(value, 100))}%`, backgroundColor: fillColor }} />
      </View>
    </View>
  );
}

export function ProgressBar({ progress, tone = "accent" }: { progress: number; tone?: "accent" | "warn" | "danger" }) {
  const p = usePalette();
  const fg = tone === "warn" ? p.warn : tone === "danger" ? p.danger : p.accent;
  return (
    <View style={{ height: 8, backgroundColor: p.surface2, borderRadius: radius.pill, overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${Math.max(2, Math.min(progress, 100))}%`, backgroundColor: fg }} />
    </View>
  );
}

export function Gauge({ value, size = 120, label }: { value: number; size?: number; label?: string }) {
  const p = usePalette();
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={p.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c}`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color: p.ink, fontSize: 28, fontWeight: "900" }}>{Math.round(pct)}</Text>
        {label ? <Text style={{ color: p.muted, fontSize: 11, fontWeight: "700" }}>{label}</Text> : null}
      </View>
    </View>
  );
}

export function Row({ children, divider = true }: { children: ReactNode; divider?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
        justifyContent: "space-between",
        borderTopColor: divider ? p.line : "transparent",
        borderTopWidth: divider ? 1 : 0,
        paddingTop: divider ? 12 : 0
      }}
    >
      {children}
    </View>
  );
}

export function KV({ k, v, vTone = "ink" }: { k: string; v: string; vTone?: "ink" | "muted" | "accent" | "danger" | "warn" }) {
  const p = usePalette();
  const colors: Record<string, string> = { ink: p.ink, muted: p.muted, accent: p.accent, danger: p.danger, warn: p.warn };
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ color: p.muted, fontSize: 13 }}>{k}</Text>
      <Text style={{ color: colors[vTone], fontSize: 14, fontWeight: "800" }}>{v}</Text>
    </View>
  );
}

export function Divider() {
  const p = usePalette();
  return <View style={{ height: 1, backgroundColor: p.line, marginVertical: 4 }} />;
}

export function ScreenHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 6, marginTop: 4, marginBottom: 4 }}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Text style={{ color: p.ink, fontSize: 28, lineHeight: 32, fontWeight: "900" }}>{title}</Text>
      {subtitle ? <Text style={{ color: p.muted, fontSize: 14, lineHeight: 20 }}>{subtitle}</Text> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  // Kept for backwards compatibility with the original App.tsx import path.
  // New code should use the themed components above.
  scroll: { padding: 16, paddingBottom: 110, gap: 14 }
});
