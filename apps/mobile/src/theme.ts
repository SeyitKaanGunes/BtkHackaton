import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark";

export type ThemePalette = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentSoft: string;
  accent2: string;
  accent2Soft: string;
  warn: string;
  warnSoft: string;
  danger: string;
  dangerSoft: string;
  good: string;
  goodSoft: string;
  onAccent: string;
  scrim: string;
};

export const lightPalette: ThemePalette = {
  bg: "#EEF1EA",
  surface: "#FBFCF7",
  surface2: "#E8EEE9",
  ink: "#101815",
  muted: "#66756D",
  line: "#D9E1DB",
  accent: "#2557D6",
  accentSoft: "#DFE9FF",
  accent2: "#0D7966",
  accent2Soft: "#D8F3EA",
  warn: "#B45309",
  warnSoft: "#FAECD6",
  danger: "#C12B4E",
  dangerSoft: "#FDE3E9",
  good: "#168353",
  goodSoft: "#DFF5E9",
  onAccent: "#FFFFFF",
  scrim: "rgba(16,24,21,0.6)"
};

export const darkPalette: ThemePalette = {
  bg: "#040A1E",
  surface: "#0B1330",
  surface2: "#131D44",
  ink: "#EAF0FB",
  muted: "#7B8BB6",
  line: "#1C284A",
  accent: "#60A5FA",
  accentSoft: "#10224F",
  accent2: "#B6C2EE",
  accent2Soft: "#1A2454",
  warn: "#FBBF24",
  warnSoft: "#3A2913",
  danger: "#F87093",
  dangerSoft: "#3B1521",
  good: "#60A5FA",
  goodSoft: "#10224F",
  onAccent: "#040A1E",
  scrim: "rgba(0,0,0,0.7)"
};

export const palettes: Record<ThemeMode, ThemePalette> = {
  light: lightPalette,
  dark: darkPalette
};

export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32 };
export const fontSize = { xs: 11, sm: 12, base: 13, md: 14, lg: 16, xl: 18, h3: 22, h2: 28, h1: 34 };

export type ThemeContextValue = {
  mode: ThemeMode;
  palette: ThemePalette;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  palette: lightPalette,
  toggle: () => undefined,
  setMode: () => undefined
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function usePalette(): ThemePalette {
  return useContext(ThemeContext).palette;
}
