import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export const palette = {
  bg: "#f6f7f4",
  surface: "#ffffff",
  surface2: "#eef2ef",
  ink: "#17211d",
  muted: "#6d7974",
  line: "#dce3df",
  accent: "#0f766e",
  accent2: "#4f46e5",
  warn: "#b45309",
  danger: "#be123c"
};

export function Panel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

export function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function PillButton({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function RiskBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.riskBar}>
      <View style={styles.riskHeader}>
        <Text style={styles.riskLabel}>{label}</Text>
        <Text style={styles.riskValue}>{value}/100</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(6, Math.min(value, 100))}%` }]} />
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg
  },
  scroll: {
    padding: 18,
    paddingBottom: 110,
    gap: 14
  },
  header: {
    gap: 8,
    marginTop: 8,
    marginBottom: 6
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: palette.ink,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: 0
  },
  subtitle: {
    color: palette.muted,
    lineHeight: 20
  },
  panel: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 12
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  stat: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 112,
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    justifyContent: "space-between"
  },
  statLabel: {
    color: palette.muted,
    fontSize: 13
  },
  statValue: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    borderTopColor: palette.line,
    borderTopWidth: 1,
    paddingTop: 12
  },
  rowText: {
    flex: 1,
    color: palette.ink,
    fontWeight: "700"
  },
  muted: {
    color: palette.muted
  },
  riskBar: {
    gap: 7
  },
  riskHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  riskLabel: {
    color: palette.ink,
    fontWeight: "700"
  },
  riskValue: {
    color: palette.muted
  },
  track: {
    height: 9,
    backgroundColor: palette.surface2,
    borderRadius: 99,
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    backgroundColor: palette.accent
  },
  tabBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 18,
    backgroundColor: palette.ink,
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    gap: 6
  },
  pill: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center"
  },
  pillActive: {
    backgroundColor: "#ffffff"
  },
  pillText: {
    color: "#cbd5d0",
    fontWeight: "800",
    fontSize: 12
  },
  pillTextActive: {
    color: palette.ink
  },
  input: {
    minHeight: 96,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: palette.ink,
    backgroundColor: "#fbfcfa",
    textAlignVertical: "top"
  },
  dateInput: {
    minHeight: 44,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: palette.ink,
    backgroundColor: "#fbfcfa"
  },
  primaryButton: {
    backgroundColor: palette.ink,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  scenario: {
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 6
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: palette.surface2,
    borderRadius: 8,
    padding: 4,
    gap: 4
  },
  segment: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center"
  },
  segmentActive: {
    backgroundColor: "#ffffff"
  },
  segmentText: {
    color: palette.muted,
    fontWeight: "800"
  },
  segmentTextActive: {
    color: palette.ink,
    fontWeight: "900"
  },
  subscriptionCard: {
    borderTopColor: palette.line,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 10
  }
});
