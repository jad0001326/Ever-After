import { Platform, type TextStyle } from "react-native";

export const lightColors = {
  canvas: "#FBF7EF",
  canvasRaised: "#FFFDF8",
  primary: "#173526",
  onPrimary: "#FFFDF8",
  accent: "#9C542D",
  text: "#2F332F",
  textMuted: "#62655F",
  border: "#D9CDBD",
  successSurface: "#E8F0E8",
  focus: "#C36C3C",
} as const;

export const darkColors: AppColors = {
  canvas: "#101814",
  canvasRaised: "#17221C",
  primary: "#D7E8D7",
  onPrimary: "#173526",
  accent: "#F0AA82",
  text: "#F4EEE4",
  textMuted: "#C8C1B7",
  border: "#46564C",
  successSurface: "#26372E",
  focus: "#F0AA82",
};

export type AppColors = { [Key in keyof typeof lightColors]: string };

const displayFont = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia" });

export const typography = {
  display: { fontFamily: displayFont, fontWeight: "400" } satisfies TextStyle,
  body: { fontSize: 17, lineHeight: 25 } satisfies TextStyle,
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: 1.4 } satisfies TextStyle,
  tab: { fontSize: 12, lineHeight: 16, fontWeight: "600" } satisfies TextStyle,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  pill: 999,
} as const;
