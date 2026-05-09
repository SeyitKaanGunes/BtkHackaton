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
  bg: "#F6F7F4",
  surface: "#FFFFFF",
  surface2: "#EEF2EF",
  ink: "#17211D",
  muted: "#6D7974",
  line: "#DCE3DF",
  accent: "#0F766E",
  accentSoft: "#DCEFEC",
  accent2: "#4F46E5",
  accent2Soft: "#E4E2FA",
  warn: "#B45309",
  warnSoft: "#FBF1E2",
  danger: "#BE123C",
  dangerSoft: "#FBE6EC",
  good: "#0F766E",
  goodSoft: "#DCEFEC",
  onAccent: "#FFFFFF",
  scrim: "rgba(23,33,29,0.55)"
};

export const darkPalette: ThemePalette = {
  bg: "#0B100E",
  surface: "#141A18",
  surface2: "#1B2320",
  ink: "#ECF1EE",
  muted: "#8A958F",
  line: "#252E2A",
  accent: "#34C7B5",
  accentSoft: "#0F3935",
  accent2: "#A5A0FF",
  accent2Soft: "#272560",
  warn: "#F0A85B",
  warnSoft: "#3A2913",
  danger: "#F87093",
  dangerSoft: "#3B1521",
  good: "#34C7B5",
  goodSoft: "#0F3935",
  onAccent: "#0B100E",
  scrim: "rgba(0,0,0,0.65)"
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
