import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AppColors, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";

export function AuthCallbackScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.screen}>
      <View accessibilityLiveRegion="polite" style={styles.content}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text accessibilityRole="header" style={styles.title}>Finishing secure sign-in</Text>
        <Text style={styles.body}>This should only take a moment.</Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvas, justifyContent: "center", padding: spacing.lg },
    content: { alignItems: "center", gap: spacing.md },
    title: { ...typography.display, color: colors.primary, fontSize: 34, lineHeight: 42, textAlign: "center" },
    body: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  });
}
