import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { type AppColors, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";

export function SessionRestoringScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View accessibilityLiveRegion="polite" style={styles.screen}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text accessibilityRole="header" style={styles.title}>Opening My EverAft</Text>
      <Text style={styles.body}>Restoring your private session…</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      alignItems: "center",
      backgroundColor: colors.canvas,
      flex: 1,
      gap: spacing.md,
      justifyContent: "center",
      padding: spacing.lg,
    },
    title: { ...typography.display, color: colors.primary, fontSize: 34, lineHeight: 42 },
    body: { ...typography.body, color: colors.textMuted },
  });
}
