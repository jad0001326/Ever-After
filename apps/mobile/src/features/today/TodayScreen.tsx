import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AppColors, radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import type { DevicePlanData } from "../../planning/device-plan-model";
import { createTodayModel } from "./seeded-today";

export function TodayScreen({ data, onOpenRecommendation, saving, storageLabel = "On this device" }: { data: DevicePlanData; onOpenRecommendation: (destination: "venues" | "photography" | "plan") => void; saving: boolean; storageLabel?: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const model = useMemo(() => createTodayModel(data), [data]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.brand}>{model.workspaceName}</Text>
          <View accessible accessibilityLabel={`Storage status: ${saving ? "Saving" : storageLabel}`} style={styles.status}>
            <Text accessibilityElementsHidden style={styles.statusMark}>✓</Text>
            <Text style={styles.statusText}>{saving ? "Saving" : storageLabel}</Text>
          </View>
        </View>

        <Text accessibilityRole="header" style={styles.greeting}>{model.greeting}</Text>

        <View accessibilityLabel="Recommended next action" style={styles.nextAction}>
          <Text style={styles.eyebrow}>{model.recommendation.eyebrow}</Text>
          <Text accessibilityRole="header" style={styles.actionTitle}>{model.recommendation.title}</Text>
          <Text style={styles.reason}>{model.recommendation.reason}</Text>
          <Pressable
            accessibilityHint={model.recommendation.destination === "photography" ? "Opens photographer discovery" : model.recommendation.destination === "plan" ? "Opens your plan" : "Opens venue discovery"}
            accessibilityRole="button"
            onPress={() => onOpenRecommendation(model.recommendation.destination)}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{model.recommendation.actionLabel}</Text>
          </Pressable>
        </View>

        <View accessible accessibilityLabel="Budget summary" style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Budget</Text>
          <View style={styles.budgetGrid}>
            <BudgetValue label="Total" styles={styles} value={model.budget.total} />
            <BudgetValue label="Remaining" styles={styles} value={model.budget.remaining} />
            <BudgetValue label="Committed" styles={styles} value={model.budget.committed} />
            <BudgetValue label="Paid" styles={styles} value={model.budget.paid} />
          </View>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Coming up</Text>
          <Text style={styles.comingUp}>{model.comingUp}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type TodayStyles = ReturnType<typeof createStyles>;

function BudgetValue({ label, styles, value }: { label: string; styles: TodayStyles; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.budgetValue}>
      <Text style={styles.budgetAmount}>{value}</Text>
      <Text style={styles.budgetLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xl },
  header: { gap: spacing.sm },
  brand: { ...typography.display, color: colors.primary, fontSize: 34, lineHeight: 42 },
  status: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing.sm, minHeight: 44 },
  statusMark: { backgroundColor: colors.successSurface, borderRadius: radius.pill, color: colors.primary, fontSize: 15, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 3 },
  statusText: { ...typography.body, color: colors.textMuted, fontSize: 15 },
  greeting: { ...typography.display, color: colors.primary, fontSize: 44, lineHeight: 52 },
  nextAction: { gap: spacing.md },
  eyebrow: { ...typography.label, color: colors.accent },
  actionTitle: { ...typography.display, color: colors.primary, fontSize: 38, lineHeight: 44 },
  reason: { ...typography.body, color: colors.text },
  button: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: colors.onPrimary, fontSize: 17, fontWeight: "700" },
  section: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.md, paddingTop: spacing.lg },
  sectionTitle: { ...typography.display, color: colors.primary, fontSize: 30, lineHeight: 36 },
  budgetGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  budgetValue: { minWidth: "45%", flexGrow: 1, gap: spacing.xs },
  budgetAmount: { color: colors.primary, fontSize: 23, fontVariant: ["tabular-nums"], fontWeight: "600" },
  budgetLabel: { color: colors.textMuted, fontSize: 14 },
  comingUp: { ...typography.body, color: colors.textMuted },
  });
}
