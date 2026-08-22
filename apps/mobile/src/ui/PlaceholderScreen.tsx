import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AppColors, spacing, typography } from "../design/tokens";
import { useAppTheme } from "../design/use-app-theme";

export function PlaceholderScreen({ title, body }: { title: string; body: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas, gap: spacing.md, padding: spacing.lg },
    title: { ...typography.display, color: colors.primary, fontSize: 38, lineHeight: 46 },
    body: { ...typography.body, color: colors.text },
  });
}
