import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { spacing, typography } from "../design/tokens";
import { useAppTheme } from "../design/use-app-theme";

export function DevicePlanLoadingScreen() {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel="Opening your plan" accessibilityRole="progressbar" style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[styles.text, { color: colors.text }]}>Opening your plan…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, gap: spacing.lg, justifyContent: "center", padding: spacing.xl },
  text: { ...typography.body, textAlign: "center" },
});
