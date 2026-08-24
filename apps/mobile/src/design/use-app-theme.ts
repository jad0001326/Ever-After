import { useColorScheme } from "react-native";

import { darkColors, lightColors } from "./tokens";

export function useAppTheme() {
  const isDark = useColorScheme() === "dark";

  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
  } as const;
}
