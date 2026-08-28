import type { CatalogueVenueDetail } from "@everaft/api-client";
import type { PlanningHubVenueStatus } from "@everaft/planning-domain/planning-hub/plan";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useNativeAuth } from "../../auth/NativeAuthProvider";
import { createNativeCatalogueClient } from "../../catalogue/catalogue-runtime";
import { radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import { useConnectedPlanning } from "../../planning/ConnectedPlanningProvider";
import { selectVenue, shortlistVenue, venuePlanningCost } from "./venue-plan-actions";

const statuses: { value: PlanningHubVenueStatus; label: string; explanation: string }[] = [
  { value: "shortlisted", label: "Estimated", explanation: "A planning estimate, not a quote." },
  { value: "quoted", label: "Quoted", explanation: "The venue has given you this price." },
  { value: "booked", label: "Booked", explanation: "You have committed to this venue." },
];

export function VenueDetailScreen() {
  const { venueId } = useLocalSearchParams<{ venueId?: string }>();
  const router = useRouter();
  const auth = useNativeAuth();
  const connected = useConnectedPlanning();
  const { colors } = useAppTheme();
  const client = useMemo(() => createNativeCatalogueClient(auth.getAccessToken), [auth.getAccessToken]);
  const [detail, setDetail] = useState<CatalogueVenueDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(client && venueId));
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<PlanningHubVenueStatus>("shortlisted");
  const [cost, setCost] = useState("");
  const ready = connected.data;

  useEffect(() => {
    let active = true;
    if (!client || !venueId) return;
    void client.getVenue(venueId)
      .then((venue) => {
        if (!active) return;
        setDetail(venue);
        const planningCost = venuePlanningCost(venue, ready?.budgetPlan.guestCount ?? null);
        setCost(planningCost > 0 ? String(Math.round(planningCost / 100)) : "");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(error instanceof Error && error.message === "not_found"
          ? "This venue is no longer available in the live catalogue."
          : "Venue details could not connect. Try again when you are online.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client, ready?.budgetPlan.guestCount, venueId]);

  async function persist(selected: boolean) {
    if (!detail || !ready) return;
    const pounds = Number(cost.replace(/[^0-9.]/g, ""));
    const costPence = Number.isFinite(pounds) ? Math.max(Math.round(pounds * 100), 0) : 0;
    const next = selected
      ? selectVenue(ready, detail, costPence, status)
      : shortlistVenue(ready, detail, costPence, status);
    try {
      const result = await connected.saveBudget(next);
      setMessage(result.outcome === "connected"
        ? selected
          ? `${detail.name} is now your chosen venue in My EverAft.`
          : `${detail.name} is on your connected shortlist.`
        : result.outcome === "needs_attention"
          ? `${detail.name} is saved on this device; My EverAft sync needs attention.`
          : selected
            ? `${detail.name} is now your chosen venue on this device.`
            : `${detail.name} is on your shortlist.`);
    } catch {
      setMessage("Your plan changed before this update completed. Please try again.");
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityLabel="Back to venue search" accessibilityRole="button" onPress={() => router.back()} style={[styles.back, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text }}>← Back</Text>
        </Pressable>
        {loading ? <ActivityIndicator accessibilityLabel="Loading venue details" color={colors.accent} size="large" /> : null}
        {detail ? (
          <>
            {detail.imageUrl ? <Image accessibilityLabel={`${detail.name} ${detail.imageStatus === "approved" ? "venue-approved photograph" : "illustrated profile"}`} source={{ uri: detail.imageUrl }} style={styles.hero} /> : null}
            <Text style={[styles.eyebrow, { color: colors.accent }]}>{detail.type} · {detail.town}, {detail.region}</Text>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>{detail.name}</Text>
            <Text style={[styles.imageLabel, { color: colors.textMuted }]}>{imageDisclosure(detail.imageStatus)}</Text>
            <Text style={[styles.body, { color: colors.text }]}>{detail.description || detail.summary}</Text>
            <Text style={[styles.meta, { color: colors.text }]}>Up to {detail.capacityMax} guests</Text>
            {detail.amenities.length ? <Text style={[styles.body, { color: colors.textMuted }]}>{detail.amenities.join(" · ")}</Text> : null}

            <View accessibilityRole="radiogroup" style={[styles.decision, { borderColor: colors.border, backgroundColor: colors.canvasRaised }]}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.primary }]}>Use this in your plan</Text>
              {statuses.map((option) => (
                <Pressable
                  accessibilityLabel={`${option.label}. ${option.explanation}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: status === option.value }}
                  key={option.value}
                  onPress={() => setStatus(option.value)}
                  style={[styles.radio, { borderColor: status === option.value ? colors.accent : colors.border }]}
                >
                  <Text style={[styles.radioTitle, { color: colors.text }]}>{option.label}</Text>
                  <Text style={{ color: colors.textMuted }}>{option.explanation}</Text>
                </Pressable>
              ))}
              <TextInput
                accessibilityLabel="Venue planning cost in pounds"
                inputMode="decimal"
                onChangeText={setCost}
                placeholder="Planning cost, £"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={cost}
              />
              <Pressable accessibilityRole="button" onPress={() => void persist(false)} style={[styles.secondaryButton, { borderColor: colors.primary }]}>
                <Text style={[styles.buttonText, { color: colors.primary }]}>Add to shortlist</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => void persist(true)} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Choose as my venue</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        {message || !client || !venueId ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.text }]}>{message ?? "Venue details are unavailable in this build."}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function imageDisclosure(status: CatalogueVenueDetail["imageStatus"]) {
  if (status === "approved") return "Venue-approved photography";
  if (status === "representative") return "EverAft illustrated profile; venue photography is awaiting approval";
  return "Venue photography is not yet available";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md },
  hero: { width: "100%", height: 260, borderRadius: radius.md },
  eyebrow: { ...typography.label },
  title: { ...typography.display, fontSize: 38, lineHeight: 44 },
  sectionTitle: { ...typography.display, fontSize: 26, lineHeight: 32 },
  body: { ...typography.body },
  imageLabel: { fontSize: 14 },
  meta: { fontSize: 17, fontWeight: "700" },
  decision: { gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  radio: { minHeight: 60, borderWidth: 2, borderRadius: radius.sm, justifyContent: "center", padding: spacing.md },
  radioTitle: { fontSize: 16, fontWeight: "700" },
  input: { minHeight: 50, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, fontSize: 16 },
  primaryButton: { minHeight: 50, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  secondaryButton: { minHeight: 50, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  buttonText: { fontSize: 16, fontWeight: "700" },
  message: { ...typography.body, paddingVertical: spacing.sm },
});
