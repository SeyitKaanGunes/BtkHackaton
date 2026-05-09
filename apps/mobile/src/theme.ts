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
  bg: "#DCE6F8",
  surface: "#FFFFFF",
  surface2: "#C9D6EF",
  ink: "#070C1C",
  muted: "#4F5B7A",
  line: "#B5C2DD",
  accent: "#1D4ED8",
  accentSoft: "#DBE7FB",
  accent2: "#0B1438",
  accent2Soft: "#C7D2EE",
  warn: "#B45309",
  warnSoft: "#FBF1E2",
  danger: "#BE123C",
  dangerSoft: "#FBE6EC",
  good: "#1D4ED8",
  goodSoft: "#DBE7FB",
  onAccent: "#FFFFFF",
  scrim: "rgba(7,12,28,0.6)"
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

export const radius = { sm: 8, md: 12, lg: 14, pill: 999 };
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
