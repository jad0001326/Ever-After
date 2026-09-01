import { getTablePlanGuestOverview } from "@everaft/planning-domain/table-plan/guests";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AppColors, radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import type { DevicePlanData } from "../../planning/device-plan-model";

type GuestTableSummaryScreenProps = Readonly<{
  data: DevicePlanData;
  mode: "guests" | "tables";
  onBack(): void;
  onOpenWebPlanner?: () => Promise<void>;
}>;

export function GuestTableSummaryScreen(props: GuestTableSummaryScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [message, setMessage] = useState<string | null>(null);
  const plan = props.data.workspace.tablePlan;
  const overview = useMemo(
    () => getTablePlanGuestOverview(plan, props.data.workspace.profile.guestCount ?? 0),
    [plan, props.data.workspace.profile.guestCount],
  );
  const connected = props.data.workspace.cloudWorkspaceId !== null;
  const seatCount = plan.tables.reduce((total, table) => total + table.capacity, 0);
  const title = props.mode === "guests" ? "Guests" : "Tables";

  async function openWebPlanner() {
    if (!props.onOpenWebPlanner) return;
    setMessage(null);
    try {
      await props.onOpenWebPlanner();
    } catch {
      setMessage("The web planner could not be opened. Your native plan is unchanged.");
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={props.onBack} style={styles.backButton}>
          <Text style={styles.backText}>Back to plan</Text>
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>GUESTS &amp; SEATING</Text>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.body}>
            {props.mode === "guests"
              ? "A privacy-safe summary of the guest list currently held in your plan."
              : "A compact summary of tables and current assignments."}
          </Text>
        </View>

        <View style={styles.metricGrid}>
          {props.mode === "guests" ? (
            <>
              <Metric label="Total guests" value={overview.totalCount} styles={styles} />
              <Metric label="Accepted" value={overview.acceptedCount} styles={styles} />
              <Metric label="Awaiting RSVP" value={overview.pendingCount} styles={styles} />
              <Metric label="Declined" value={overview.declinedCount} styles={styles} />
              <Metric label="Dietary notes" value={overview.dietaryCount} styles={styles} />
              <Metric label="Still to add" value={overview.targetGap} styles={styles} />
            </>
          ) : (
            <>
              <Metric label="Tables" value={plan.tables.length} styles={styles} />
              <Metric label="Seats" value={seatCount} styles={styles} />
              <Metric label="Assigned" value={overview.assignedCount} styles={styles} />
              <Metric label="Unassigned" value={overview.unassignedCount} styles={styles} />
              <Metric label="Locked tables" value={plan.tables.filter((table) => table.locked).length} styles={styles} />
              <Metric label="Seating rules" value={plan.rules.length} styles={styles} />
            </>
          )}
        </View>

        <View style={styles.handoffCard}>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            {connected ? "Edit in your connected web workspace" : "Use the separate public web planner"}
          </Text>
          <Text style={styles.body}>
            {connected
              ? "Full guest and table editing stays on the protected EverAft web workspace until the native editors pass their release checks. You may need to sign in in your browser."
              : "This device-only plan does not sync into the public web planner. Opening it starts a separate browser-based table plan."}
          </Text>
          {props.onOpenWebPlanner ? (
            <Pressable
              accessibilityHint="Opens the EverAft website in your browser; returning restores this native screen"
              accessibilityRole="button"
              onPress={() => { void openWebPlanner(); }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {connected ? "Open connected web planner" : "Open separate public web planner"}
              </Text>
            </Pressable>
          ) : (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              Web handoff is unavailable until the EverAft app address is configured.
            </Text>
          )}
          {message ? <Text accessibilityLiveRegion="assertive" style={styles.notice}>{message}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type GuestTableStyles = ReturnType<typeof createStyles>;

function Metric({ label, value, styles }: { label: string; value: number; styles: GuestTableStyles }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
    backButton: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44, paddingRight: spacing.md },
    backText: { color: colors.primary, fontSize: 15, fontWeight: "700" },
    heading: { gap: spacing.sm },
    eyebrow: { ...typography.label, color: colors.accent },
    title: { ...typography.display, color: colors.primary, fontSize: 42, lineHeight: 48 },
    body: { ...typography.body, color: colors.textMuted },
    metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    metric: { minWidth: "45%", flexGrow: 1, backgroundColor: colors.canvasRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
    metricValue: { color: colors.primary, fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
    metricLabel: { color: colors.textMuted, fontSize: 14 },
    handoffCard: { gap: spacing.md, backgroundColor: colors.canvasRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
    cardTitle: { ...typography.display, color: colors.primary, fontSize: 25, lineHeight: 31 },
    primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.pill, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
    primaryButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700", textAlign: "center" },
    notice: { color: colors.accent, fontSize: 15, lineHeight: 22 },
  });
}
