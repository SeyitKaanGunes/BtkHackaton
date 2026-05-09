import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, StatusBar, useColorScheme } from "react-native";
import { ThemeContext, palettes, type ThemeMode } from "../theme";

type Props = {
  children: ReactNode;
  initial?: ThemeMode | "system";
};

export function ThemeProvider({ children, initial = "system" }: Props) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initial === "system" ? (system === "dark" ? "dark" : "light") : initial);

  useEffect(() => {
    if (initial !== "system") return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setModeState(colorScheme === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, [initial]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggle = useCallback(() => setModeState((m) => (m === "dark" ? "light" : "dark")), []);

  const value = useMemo(() => ({ mode, palette: palettes[mode], toggle, setMode }), [mode, toggle, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} backgroundColor={value.palette.bg} />
      {children}
    </ThemeContext.Provider>
  );
}
