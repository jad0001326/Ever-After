import {
  calculatePlanningHubPlan,
  getPlanningHubItemAvailability,
} from "@everaft/planning-domain/planning-hub/plan";
import { getTablePlanGuestOverview } from "@everaft/planning-domain/table-plan/guests";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import type { DevicePlanData } from "../../planning/device-plan-model";

type VenuePlanScreenProps = Readonly<{
  data: DevicePlanData;
  onDiscover(): void;
  onGuests(): void;
  onPayments(): void;
  onTables(): void;
  onTasks(): void;
}>;

export function VenuePlanScreen({ data, onDiscover, onGuests, onPayments, onTables, onTasks }: VenuePlanScreenProps) {
  const { colors } = useAppTheme();
  const summary = useMemo(() => calculatePlanningHubPlan(data.budgetPlan), [data.budgetPlan]);
  const guestOverview = useMemo(
    () => getTablePlanGuestOverview(data.workspace.tablePlan, data.workspace.profile.guestCount ?? 0),
    [data.workspace.profile.guestCount, data.workspace.tablePlan],
  );
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
          const availability = availabilityLabel(venue, data.budgetPlan.weddingDate);
          const payment = paymentLabel(venue, cost);
          return (
            <View accessibilityLabel={`${venue.itemName}, ${selected ? "chosen venue" : venue.bookingStatus}, ${cost === null ? "cost not set" : money(cost)}, ${payment}, ${availability}`} key={venue.id} style={[styles.card, { backgroundColor: colors.canvasRaised, borderColor: selected ? colors.accent : colors.border }]}>
              <View style={styles.cardHeader}>
                <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.primary }]}>{venue.itemName}</Text>
                {selected ? <Text style={[styles.badge, { backgroundColor: colors.successSurface, color: colors.primary }]}>CHOSEN</Text> : null}
              </View>
              <Text style={{ color: colors.textMuted }}>{statusLabel(venue.bookingStatus)} · {venue.source === "manual" ? "Added manually" : "EverAft catalogue"}</Text>
              <Text style={[styles.cost, { color: colors.text }]}>{cost === null ? "Cost not set" : money(cost)}</Text>
              <Text style={{ color: colors.text }}>{payment}</Text>
              <Text style={{ color: colors.textMuted }}>{availability}</Text>
            </View>
          );
        }) : (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.primary }]}>No venue shortlisted yet</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>Start with a live venue or add one manually.</Text>
          </View>
        )}

        <View style={[styles.tablePlanCard, { backgroundColor: colors.canvasRaised, borderColor: colors.border }]}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>GUESTS &amp; SEATING</Text>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.primary }]}>Plan the people around your day</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {guestOverview.totalCount} guests · {guestOverview.pendingCount} awaiting RSVP · {guestOverview.unassignedCount} unassigned
          </Text>
          <View style={styles.inlineActions}>
            <Pressable accessibilityRole="button" onPress={onGuests} style={[styles.inlineButton, { borderColor: colors.primary }]}>
              <Text style={[styles.inlineButtonText, { color: colors.primary }]}>Review guests</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onTables} style={[styles.inlineButton, { borderColor: colors.primary }]}>
              <Text style={[styles.inlineButtonText, { color: colors.primary }]}>Review tables</Text>
            </Pressable>
          </View>
        </View>

        <Pressable accessibilityRole="button" onPress={onDiscover} style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Explore venues</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onTasks} style={[styles.secondaryButton, { borderColor: colors.primary }]}>
          <Text style={[styles.buttonText, { color: colors.primary }]}>Manage tasks</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onPayments} style={[styles.secondaryButton, { borderColor: colors.primary }]}>
          <Text style={[styles.buttonText, { color: colors.primary }]}>Manage payments</Text>
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

function paymentLabel(
  item: DevicePlanData["budgetPlan"]["items"][number],
  cost: number | null,
) {
  const paid = Math.max(item.totalPaidPence, item.depositPaidPence, 0);
  const paidLabel = paid > 0
    ? cost !== null && paid >= cost ? "Paid in full" : `${money(paid)} paid`
    : "No payment recorded";
  if (!item.dueDate) return paidLabel;
  const due = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${item.dueDate}T00:00:00.000Z`));
  return `${paidLabel} · next due ${due}`;
}

function availabilityLabel(
  item: DevicePlanData["budgetPlan"]["items"][number],
  weddingDate: string | null,
) {
  const availability = getPlanningHubItemAvailability(item, weddingDate);
  if (availability.stale) return "Availability needs rechecking for your date";
  if (availability.status === "available") return "Available for your date";
  if (availability.status === "unavailable") return "Unavailable for your date";
  if (availability.status === "enquiry_sent") return "Availability enquiry sent";
  return "Availability not checked";
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
  tablePlanCard: { gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.lg },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  inlineButton: { minHeight: 48, flexGrow: 1, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  inlineButtonText: { fontSize: 15, fontWeight: "700" },
  button: { minHeight: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  buttonText: { fontSize: 16, fontWeight: "700" },
  secondaryButton: { minHeight: 52, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
});
