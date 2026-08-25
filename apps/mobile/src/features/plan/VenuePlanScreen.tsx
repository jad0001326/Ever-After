import { calculatePlanningHubPlan } from "@everaft/planning-domain/planning-hub/plan";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import type { DevicePlanData } from "../../planning/device-plan-model";

export function VenuePlanScreen({ data, onDiscover }: { data: DevicePlanData; onDiscover(): void }) {
  const { colors } = useAppTheme();
  const summary = useMemo(() => calculatePlanningHubPlan(data.budgetPlan), [data.budgetPlan]);
  const venues = data.budgetPlan.items.filter((item) => item.categoryId === "venue" && item.bookingStatus !== "cancelled");

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.canvas }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>YOUR PLAN</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>Venue decisions</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>Saved is a bookmark. A shortlist affects your plan; only your chosen venue drives the next planning stage.</Text>

        <View accessible accessibilityLabel={`Budget remaining ${money(summary.remainingPence)}`} style={[styles.summary, { backgroundColor: colors.canvasRaised, borderColor: colors.border }]}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{money(summary.remainingPence)}</Text>
          <Text style={{ color: colors.textMuted }}>remaining from {money(summary.totalBudgetPence)}</Text>
        </View>

        {venues.length ? venues.map((venue) => {
          const selected = data.budgetPlan.selectedVenueId !== null
            && (data.budgetPlan.selectedVenueId === venue.id || data.budgetPlan.selectedVenueId === venue.listingId);
          const cost = venue.confirmedCostPence ?? venue.estimatedCostPence;
          return (
            <View accessibilityLabel={`${venue.itemName}, ${selected ? "chosen venue" : venue.bookingStatus}, ${cost === null ? "cost not set" : money(cost)}`} key={venue.id} style={[styles.card, { backgroundColor: colors.canvasRaised, borderColor: selected ? colors.accent : colors.border }]}>
              <View style={styles.cardHeader}>
                <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.primary }]}>{venue.itemName}</Text>
                {selected ? <Text style={[styles.badge, { backgroundColor: colors.successSurface, color: colors.primary }]}>CHOSEN</Text> : null}
              </View>
              <Text style={{ color: colors.textMuted }}>{statusLabel(venue.bookingStatus)} · {venue.source === "manual" ? "Added manually" : "EverAft catalogue"}</Text>
              <Text style={[styles.cost, { color: colors.text }]}>{cost === null ? "Cost not set" : money(cost)}</Text>
            </View>
          );
        }) : (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.primary }]}>No venue shortlisted yet</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>Start with a live venue or add one manually.</Text>
          </View>
        )}

        <Pressable accessibilityRole="button" onPress={onDiscover} style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Explore venues</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value / 100);
}

function statusLabel(status: string) {
  if (status === "booked") return "Booked";
  if (status === "quoted") return "Quoted";
  return "Estimated shortlist";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { ...typography.label },
  title: { ...typography.display, fontSize: 38, lineHeight: 44 },
  body: { ...typography.body },
  summary: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  summaryValue: { fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  card: { gap: spacing.sm, borderWidth: 2, borderRadius: radius.md, padding: spacing.md },
  cardHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  cardTitle: { ...typography.display, flexShrink: 1, fontSize: 24, lineHeight: 30 },
  badge: { borderRadius: radius.pill, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  cost: { fontSize: 18, fontWeight: "700" },
  empty: { gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.lg },
  button: { minHeight: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  buttonText: { fontSize: 16, fontWeight: "700" },
});
