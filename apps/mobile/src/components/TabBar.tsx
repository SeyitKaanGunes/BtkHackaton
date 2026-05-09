import { Pressable, Text, View } from "react-native";
import { Bot, BriefcaseBusiness, ReceiptText, WalletCards } from "lucide-react-native";
import { useTheme } from "../theme";

export type Tab = "home" | "agent" | "scan" | "business";

const ITEMS: { id: Tab; label: string; Icon: typeof Bot }[] = [
  { id: "home", label: "Kişisel", Icon: WalletCards },
  { id: "agent", label: "Agent", Icon: Bot },
  { id: "scan", label: "Fiş", Icon: ReceiptText },
  { id: "business", label: "KOBİ", Icon: BriefcaseBusiness }
];

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const { palette: p } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 12,
        backgroundColor: p.surface,
        borderColor: p.line,
        borderWidth: 1,
        borderRadius: 16,
        padding: 6,
        flexDirection: "row",
        gap: 4,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8
      }}
    >
      {ITEMS.map((item) => {
        const isActive = item.id === active;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            android_ripple={{ color: p.line, borderless: false }}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isActive ? p.ink : "transparent",
              gap: 4
            }}
          >
            <item.Icon color={isActive ? p.surface : p.muted} size={18} />
            <Text style={{ color: isActive ? p.surface : p.muted, fontSize: 11, fontWeight: "800" }}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
