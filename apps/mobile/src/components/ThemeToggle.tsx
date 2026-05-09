import { Pressable, View } from "react-native";
import { Moon, Sun } from "lucide-react-native";
import { useTheme } from "../theme";

export function ThemeToggle({ size = 36 }: { size?: number }) {
  const { mode, toggle, palette: p } = useTheme();
  const isDark = mode === "dark";
  return (
    <Pressable
      onPress={toggle}
      android_ripple={{ color: p.line, borderless: true }}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: p.surface,
        borderColor: p.line,
        borderWidth: 1
      }}
    >
      {isDark ? <Sun color={p.accent} size={18} /> : <Moon color={p.ink} size={18} />}
    </Pressable>
  );
}
