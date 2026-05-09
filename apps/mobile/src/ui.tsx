import type { ReactNode } from "react";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

export const palette = {
  bg: "#F6F7F4",
  surface: "#FFFFFF",
  surface2: "#EEF2EF",
  ink: "#17211D",
  muted: "#6D7974",
  line: "#DCE3DF",
  primary: "#1D4ED8",
  secondary: "#0B1220",
  teal: "#0F766E",
  warn: "#B45309",
  danger: "#BE123C",
  success: "#15803D",
  primarySoft: "#DBEAFE",
  tealSoft: "#CCFBF1",
  warnSoft: "#FEF3C7",
  dangerSoft: "#FFE4E6",
  successSoft: "#DCFCE7",
  darkMuted: "#91A0B5"
};

export type Tone = "primary" | "teal" | "warn" | "danger" | "success" | "muted" | "accent" | "good" | "neutral";

const toneColor: Record<Tone, string> = {
  primary: palette.primary,
  accent: palette.primary,
  good: palette.success,
  neutral: palette.muted,
  teal: palette.teal,
  warn: palette.warn,
  danger: palette.danger,
  success: palette.success,
  muted: palette.muted
};

const toneSoft: Record<Tone, string> = {
  primary: palette.primarySoft,
  accent: palette.primarySoft,
  good: palette.successSoft,
  neutral: palette.surface2,
  teal: palette.tealSoft,
  warn: palette.warnSoft,
  danger: palette.dangerSoft,
  success: palette.successSoft,
  muted: palette.surface2
};

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  right
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function SectionTitle({ title, meta, children }: { title?: string; meta?: string; children?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionLabel}>{title ?? children}</Text>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: toneSoft[tone] }]}>
      <Text style={[styles.badgeText, { color: toneColor[tone] }]}>{label}</Text>
    </View>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  caption,
  tone = "teal",
  style
}: {
  icon: ReactNode;
  label: string;
  value: string;
  caption?: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.metric, style]}>
      <View style={[styles.iconShell, { backgroundColor: toneSoft[tone] }]}>{icon}</View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {caption ? <Text style={styles.metricCaption}>{caption}</Text> : null}
    </View>
  );
}

export function Gauge({
  score,
  value,
  size = 102,
  label = "Sağlık"
}: {
  score?: number;
  value?: number;
  size?: number;
  label?: string;
}) {
  const nextScore = score ?? value ?? 0;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * (1 - Math.max(0, Math.min(nextScore, 100)) / 100);

  return (
    <View style={[styles.gauge, { height: size, width: size }]}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={palette.surface2}
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={nextScore >= 70 ? palette.success : nextScore >= 50 ? palette.warn : palette.danger}
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={progress}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.gaugeCenter}>
        <Text style={styles.gaugeValue}>{nextScore}</Text>
        <Text style={styles.gaugeLabel}>/100</Text>
        <Text style={styles.gaugeCaption}>{label}</Text>
      </View>
    </View>
  );
}

export function ProgressBar({
  value,
  progress,
  tone = "primary",
  height = 8
}: {
  value?: number;
  progress?: number;
  tone?: Tone;
  height?: number;
}) {
  const nextValue = value ?? progress ?? 0;
  return (
    <View style={[styles.progressTrack, { height }]}>
      <View
        style={[
          styles.progressFill,
          {
            backgroundColor: toneColor[tone],
            width: `${Math.max(4, Math.min(nextValue, 100))}%`
          }
        ]}
      />
    </View>
  );
}

export function RiskBar({
  label,
  value,
  amount,
  tone = value >= 85 ? "danger" : value >= 65 ? "warn" : "teal"
}: {
  label: string;
  value: number;
  amount?: string;
  tone?: Tone;
}) {
  return (
    <View style={styles.riskBar}>
      <View style={styles.riskHeader}>
        <View>
          <Text style={styles.riskLabel}>{label}</Text>
          {amount ? <Text style={styles.riskAmount}>{amount}</Text> : null}
        </View>
        <Text style={[styles.riskValue, { color: toneColor[tone] }]}>{value}</Text>
      </View>
      <ProgressBar value={value} tone={tone} />
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  style,
  textStyle,
  disabled
}: {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      {icon}
      <Text
        style={[
          styles.buttonText,
          variant === "primary" && styles.buttonTextPrimary,
          variant === "secondary" && styles.buttonTextSecondary,
          variant === "ghost" && styles.buttonTextGhost,
          variant === "danger" && styles.buttonTextDanger,
          textStyle
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  children,
  onPress,
  tone = "primary"
}: {
  children: ReactNode;
  onPress?: () => void;
  tone?: Tone;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: toneSoft[tone] }, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function BottomTabButton({
  label,
  active,
  icon,
  onPress
}: {
  label: string;
  active?: boolean;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tabItem, active && styles.tabItemActive, pressed && styles.pressed]}>
      {icon}
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function Mono({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.mono, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Panel style={style}>{children}</Panel>;
}

export function Chip({
  children,
  label,
  tone = "muted",
  small
}: {
  children?: ReactNode;
  label?: string;
  tone?: Tone;
  small?: boolean;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: toneSoft[tone] }, small && compat.smallChip]}>
      <Text style={[styles.badgeText, { color: toneColor[tone] }, small && compat.smallChipText]}>{label ?? String(children ?? "")}</Text>
    </View>
  );
}

export function Btn({
  children,
  label,
  onPress,
  variant = "primary",
  style,
  disabled,
  icon
}: {
  children?: ReactNode;
  label?: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Button label={label ?? String(children ?? "")} onPress={onPress} variant={variant} style={style} disabled={disabled} icon={icon} />
  );
}

export function Eyebrow({ children, tone }: { children: ReactNode; tone?: Tone | string }) {
  return <Text style={[styles.eyebrow, tone ? { color: toneColor[(tone as Tone) in toneColor ? (tone as Tone) : "primary"] } : null]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.bodyMuted, style]}>{children}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function KV({ k, v, vTone }: { k: string; v: string; vTone?: Tone | string }) {
  const nextTone = (vTone as Tone) in toneColor ? (vTone as Tone) : undefined;
  return (
    <View style={compat.kv}>
      <Text style={compat.kvKey}>{k}</Text>
      <Text style={[compat.kvValue, nextTone ? { color: toneColor[nextTone] } : null]}>{v}</Text>
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.metricGrid}>{children}</View>;
}

export function Stat({ label, value, icon, sub }: { label: string; value: string; icon: ReactNode; sub?: string }) {
  return <MetricCard label={label} value={value} icon={icon} caption={sub} />;
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg
  },
  safe: {
    flex: 1,
    backgroundColor: palette.bg
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 18 : 10,
    paddingBottom: 124,
    gap: 14
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    paddingTop: 4
  },
  headerCopy: {
    flex: 1,
    gap: 6
  },
  headerRight: {
    alignItems: "flex-end"
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: 0
  },
  subtitle: {
    color: palette.muted,
    fontSize: 13.5,
    lineHeight: 20
  },
  panel: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 14
  },
  darkPanel: {
    backgroundColor: palette.secondary,
    borderColor: palette.secondary
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  sectionTitle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  sectionLabel: {
    color: palette.ink,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "700"
  },
  sectionMeta: {
    color: palette.muted,
    fontSize: 12.5,
    fontWeight: "600"
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: "800"
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metric: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 118,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
    justifyContent: "space-between"
  },
  iconShell: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12.5,
    fontWeight: "600"
  },
  metricValue: {
    color: palette.ink,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: 0
  },
  metricCaption: {
    color: palette.muted,
    fontSize: 11.5,
    lineHeight: 16
  },
  mono: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    letterSpacing: 0
  },
  gauge: {
    alignItems: "center",
    justifyContent: "center"
  },
  gaugeCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center"
  },
  gaugeValue: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  gaugeLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: -2
  },
  gaugeCaption: {
    color: palette.muted,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 3
  },
  progressTrack: {
    backgroundColor: palette.surface2,
    borderRadius: 999,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999
  },
  riskBar: {
    gap: 8
  },
  riskHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12
  },
  riskLabel: {
    color: palette.ink,
    fontSize: 13.5,
    fontWeight: "700"
  },
  riskAmount: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2
  },
  riskValue: {
    fontSize: 18,
    fontWeight: "900",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })
  },
  button: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  buttonPrimary: {
    backgroundColor: palette.secondary
  },
  buttonSecondary: {
    backgroundColor: palette.primarySoft
  },
  buttonGhost: {
    backgroundColor: palette.surface2
  },
  buttonDanger: {
    backgroundColor: palette.dangerSoft
  },
  buttonDisabled: {
    opacity: 0.58
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "800"
  },
  buttonTextPrimary: {
    color: palette.surface
  },
  buttonTextSecondary: {
    color: palette.primary
  },
  buttonTextGhost: {
    color: palette.ink
  },
  buttonTextDanger: {
    color: palette.danger
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }]
  },
  tabBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: Platform.OS === "ios" ? 18 : 14,
    minHeight: 72,
    backgroundColor: palette.secondary,
    borderRadius: 8,
    padding: 7,
    flexDirection: "row",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { height: 8, width: 0 },
    elevation: 12
  },
  tabItem: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  tabItemActive: {
    backgroundColor: palette.surface
  },
  tabLabel: {
    color: palette.darkMuted,
    fontSize: 11.5,
    fontWeight: "800"
  },
  tabLabelActive: {
    color: palette.secondary
  },
  divider: {
    height: 1,
    backgroundColor: palette.line
  },
  muted: {
    color: palette.muted
  },
  body: {
    color: palette.ink,
    fontSize: 13.5,
    lineHeight: 20
  },
  bodyMuted: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19
  },
  strong: {
    color: palette.ink,
    fontWeight: "800"
  }
});

const compat = StyleSheet.create({
  kv: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 5,
    backgroundColor: "#FBFCFA"
  },
  kvKey: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  kvValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  smallChip: {
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  smallChipText: {
    fontSize: 10.5
  }
});
