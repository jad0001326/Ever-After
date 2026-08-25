import type { CatalogueVenue } from "@everaft/api-client";
import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { useNativeAuth } from "../../auth/NativeAuthProvider";
import { createNativeCatalogueClient } from "../../catalogue/catalogue-runtime";
import { radius, spacing, typography, type AppColors } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import { useDevicePlan } from "../../planning/DevicePlanProvider";
import {
  addManualVenue,
  setVenueSavedOnDevice,
  toggleComparedVenue,
  VenueCompareLimitError,
} from "./venue-plan-actions";

export function VenueDiscoveryScreen() {
  const router = useRouter();
  const auth = useNativeAuth();
  const devicePlan = useDevicePlan();
  const { colors } = useAppTheme();
  const client = useMemo(
    () => createNativeCatalogueClient(auth.getAccessToken),
    [auth.getAccessToken],
  );
  const ready = devicePlan.state.status === "ready" ? devicePlan.state.record.data : null;
  const [location, setLocation] = useState(ready?.workspace.profile.location ?? "");
  const [search, setSearch] = useState("");
  const [venueType, setVenueType] = useState("");
  const [venues, setVenues] = useState<CatalogueVenue[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(Boolean(client && ready));
  const [message, setMessage] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualCost, setManualCost] = useState("");
  const initialRequestStarted = useRef(false);
  const loadedFavouritesForAccount = useRef<string | null>(null);

  const load = useCallback(async (nextPage = 1) => {
    if (!client || !ready) {
      setMessage("Venue search is not configured in this build yet.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await client.searchVenues({
        search,
        location,
        type: venueType,
        guests: ready.budgetPlan.guestCount ?? undefined,
        budgetPounds: Math.max(Math.floor(ready.budgetPlan.totalBudgetPence / 100), 1),
        page: nextPage,
      });
      setVenues((current) => nextPage === 1
        ? result.venues
        : uniqueVenues([...current, ...result.venues]));
      setPage(result.page.number);
      setTotalPages(result.page.totalPages);
      if (result.venues.length === 0 && nextPage === 1) {
        setMessage("No matching venues yet. You can adjust the search or add one manually.");
      }
    } catch {
      setMessage("Venue search could not connect. Your saved plan is still available on this device.");
    } finally {
      setLoading(false);
    }
  }, [client, location, ready, search, venueType]);

  useEffect(() => {
    if (initialRequestStarted.current || !client || !ready) return;
    initialRequestStarted.current = true;
    let active = true;
    void client.searchVenues({
      location: ready.workspace.profile.location ?? undefined,
      guests: ready.budgetPlan.guestCount ?? undefined,
      budgetPounds: Math.max(Math.floor(ready.budgetPlan.totalBudgetPence / 100), 1),
      page: 1,
    }).then((result) => {
      if (!active) return;
      setVenues(result.venues);
      setPage(result.page.number);
      setTotalPages(result.page.totalPages);
      if (result.venues.length === 0) {
        setMessage("No matching venues yet. You can adjust the search or add one manually.");
      }
    }).catch(() => {
      if (active) setMessage("Venue search could not connect. Your saved plan is still available on this device.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [client, ready]);

  useEffect(() => {
    const accountId = auth.snapshot.accountId;
    if (
      !client
      || !ready
      || auth.snapshot.status !== "authenticated"
      || !accountId
      || loadedFavouritesForAccount.current === accountId
    ) return;
    loadedFavouritesForAccount.current = accountId;
    let active = true;
    void client.listFavourites().then((result) => {
      if (!active) return;
      const merged = [...new Set([...ready.discovery.savedVenueIds, ...result.venueIds])];
      if (merged.length === ready.discovery.savedVenueIds.length) return;
      return devicePlan.save({
        ...ready,
        discovery: { ...ready.discovery, savedVenueIds: merged },
      });
    }).catch(() => {
      if (active) setMessage("Cloud bookmarks could not refresh; device-saved venues remain available.");
    });
    return () => { active = false; };
  }, [auth.snapshot.accountId, auth.snapshot.status, client, devicePlan, ready]);

  const toggleSaved = useCallback(async (venue: CatalogueVenue) => {
    if (!ready) return;
    const saved = !ready.discovery.savedVenueIds.includes(venue.id);
    await devicePlan.save(setVenueSavedOnDevice(ready, venue.id, saved));
    if (auth.snapshot.status === "authenticated" && client) {
      try {
        await client.setFavourite("venue", venue.id, saved);
        setMessage(saved ? "Saved to My EverAft." : "Removed from saved venues.");
      } catch {
        setMessage(saved
          ? "Saved on this device; cloud bookmark sync needs attention."
          : "Removed on this device; cloud bookmark sync needs attention.");
      }
    } else {
      setMessage(saved ? "Saved on this device. Sign in to sync the bookmark." : "Removed from this device.");
    }
  }, [auth.snapshot.status, client, devicePlan, ready]);

  const toggleCompare = useCallback(async (venue: CatalogueVenue) => {
    if (!ready) return;
    try {
      await devicePlan.save(toggleComparedVenue(ready, venue));
      setMessage("Comparison updated on this device.");
    } catch (error) {
      setMessage(error instanceof VenueCompareLimitError
        ? error.message
        : "The comparison could not be updated.");
    }
  }, [devicePlan, ready]);

  const openVenue = useCallback((venueId: string) => {
    router.push({ pathname: "/venue/[venueId]", params: { venueId } });
  }, [router]);

  const savedVenueIds = ready?.discovery.savedVenueIds;
  const comparedVenues = ready?.discovery.comparedVenues;
  const renderVenue = useCallback(({ item }: { item: CatalogueVenue }) => (
    <VenueResultCard
      colors={colors}
      compared={comparedVenues?.some((venue) => venue.id === item.id) ?? false}
      onCompare={toggleCompare}
      onSave={toggleSaved}
      onView={openVenue}
      saved={savedVenueIds?.includes(item.id) ?? false}
      venue={item}
    />
  ), [colors, comparedVenues, openVenue, savedVenueIds, toggleCompare, toggleSaved]);

  async function addManual() {
    if (!ready) return;
    const pounds = Number(manualCost.replace(/[^0-9.]/g, ""));
    try {
      await devicePlan.save(addManualVenue(
        ready,
        manualName,
        Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
      ));
      setManualName("");
      setManualCost("");
      setMessage("Manual venue added to your shortlist on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enter a venue name.");
    }
  }

  if (!ready) return null;

  return (
    <FlatList
      contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]}
      data={venues}
      keyExtractor={(venue) => venue.id}
      ListHeaderComponent={(
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>DISCOVER</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>Find your venue</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>Eight useful results at a time, shaped by your plan.</Text>
          <TextInput
            accessibilityLabel="Venue name or style"
            onChangeText={setSearch}
            placeholder="Venue name or style"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.canvasRaised }]}
            value={search}
          />
          <TextInput
            accessibilityLabel="Venue location"
            onChangeText={setLocation}
            placeholder="Town or region"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.canvasRaised }]}
            value={location}
          />
          <TextInput
            accessibilityLabel="Venue type"
            onChangeText={setVenueType}
            placeholder="Type, for example Castle or Barn"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.canvasRaised }]}
            value={venueType}
          />
          <Pressable accessibilityRole="button" onPress={() => void load(1)} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Search venues</Text>
          </Pressable>
          {message ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.text }]}>{message}</Text> : null}
          {ready.discovery.comparedVenues.length ? (
            <View accessibilityLabel={`Comparing ${ready.discovery.comparedVenues.length} of 3 venues on this device`}>
              <Text accessibilityRole="header" style={[styles.compareSummary, { color: colors.primary }]}>Your comparison</Text>
              <ScrollView contentContainerStyle={styles.compareRow} horizontal showsHorizontalScrollIndicator={false}>
                {ready.discovery.comparedVenues.map((venue) => (
                  <View accessibilityLabel={`${venue.name}, ${venue.type}, ${venue.town}, capacity ${venue.capacityMax}, ${formatVenuePrice(venue)}`} key={venue.id} style={[styles.compareCard, { borderColor: colors.border, backgroundColor: colors.canvasRaised }]}>
                    <Text style={[styles.compareName, { color: colors.primary }]}>{venue.name}</Text>
                    <Text style={{ color: colors.textMuted }}>{venue.type} · {venue.town}</Text>
                    <Text style={{ color: colors.text }}>Up to {venue.capacityMax} guests</Text>
                    <Text style={{ color: colors.text }}>{formatVenuePrice(venue)}</Text>
                    <Pressable accessibilityLabel={`Remove ${venue.name} from comparison`} accessibilityRole="button" onPress={() => void toggleCompare(venue)} style={[styles.compareRemove, { borderColor: colors.border }]}>
                      <Text style={{ color: colors.text }}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      )}
      ListEmptyComponent={loading ? <ActivityIndicator accessibilityLabel="Loading venues" color={colors.accent} size="large" /> : null}
      renderItem={renderVenue}
      ListFooterComponent={(
        <View style={styles.footer}>
          {loading && venues.length ? <ActivityIndicator accessibilityLabel="Loading more venues" color={colors.accent} /> : null}
          {page < totalPages ? (
            <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load(page + 1)} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}>
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Show 8 more venues</Text>
            </Pressable>
          ) : null}
          <View style={[styles.manual, { borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.primary }]}>Venue not listed?</Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>Add it manually to your shortlist. You can replace the estimate when you receive a quote.</Text>
            <TextInput accessibilityLabel="Manual venue name" onChangeText={setManualName} placeholder="Venue name" placeholderTextColor={colors.textMuted} style={[styles.input, { borderColor: colors.border, color: colors.text }]} value={manualName} />
            <TextInput accessibilityLabel="Manual venue estimate in pounds" inputMode="decimal" onChangeText={setManualCost} placeholder="Estimated cost, £" placeholderTextColor={colors.textMuted} style={[styles.input, { borderColor: colors.border, color: colors.text }]} value={manualCost} />
            <Pressable accessibilityRole="button" onPress={() => void addManual()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Add manual venue</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const VenueResultCard = memo(function VenueResultCard({
  colors,
  compared,
  onCompare,
  onSave,
  onView,
  saved,
  venue,
}: {
  colors: AppColors;
  compared: boolean;
  onCompare(venue: CatalogueVenue): Promise<void>;
  onSave(venue: CatalogueVenue): Promise<void>;
  onView(venueId: string): void;
  saved: boolean;
  venue: CatalogueVenue;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.canvasRaised, borderColor: colors.border }]}>
      {venue.imageUrl ? (
        <Image accessibilityLabel={`${venue.name} ${venue.imageStatus === "approved" ? "venue-approved photograph" : "illustrated profile"}`} source={{ uri: venue.imageUrl }} style={styles.image} />
      ) : (
        <View accessibilityLabel={`${venue.name} photograph not yet available`} style={[styles.imagePlaceholder, { backgroundColor: colors.successSurface }]}>
          <Ionicons color={colors.primary} name="image-outline" size={32} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{venue.type} · {venue.town}</Text>
        <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.primary }]}>{venue.name}</Text>
        <Text numberOfLines={3} style={[styles.body, { color: colors.textMuted }]}>{venue.summary}</Text>
        <Text style={[styles.price, { color: colors.text }]}>{formatVenuePrice(venue)}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => onView(venue.id)} style={[styles.smallButton, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text }}>View</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: saved }} onPress={() => void onSave(venue)} style={[styles.smallButton, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text }}>{saved ? "Saved" : "Save"}</Text>
          </Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: compared }} onPress={() => void onCompare(venue)} style={[styles.smallButton, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text }}>{compared ? "Comparing" : "Compare"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

function uniqueVenues(venues: CatalogueVenue[]) {
  return [...new Map(venues.map((venue) => [venue.id, venue])).values()];
}

function formatVenuePrice(venue: CatalogueVenue) {
  if (venue.priceFromPence === null) return "Ask venue for pricing";
  const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(venue.priceFromPence / 100);
  return venue.pricingUnit === "per_person" ? `From ${amount} per guest` : `Planning price from ${amount}`;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.md, paddingBottom: 120 },
  header: { gap: spacing.sm, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  eyebrow: { ...typography.label },
  title: { ...typography.display, fontSize: 38, lineHeight: 44 },
  cardTitle: { ...typography.display, fontSize: 25, lineHeight: 31 },
  body: { ...typography.body },
  input: { minHeight: 50, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, fontSize: 16 },
  primaryButton: { minHeight: 50, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  buttonText: { fontSize: 16, fontWeight: "700" },
  message: { ...typography.body, paddingVertical: spacing.sm },
  compareSummary: { ...typography.display, fontSize: 24, lineHeight: 30, marginBottom: spacing.sm },
  compareRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  compareCard: { width: 230, gap: spacing.xs, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  compareName: { ...typography.display, fontSize: 20, lineHeight: 25 },
  compareRemove: { alignSelf: "flex-start", minHeight: 40, borderWidth: 1, borderRadius: radius.pill, justifyContent: "center", paddingHorizontal: spacing.md, marginTop: spacing.xs },
  card: { borderWidth: 1, borderRadius: radius.md, overflow: "hidden", marginBottom: spacing.md },
  image: { width: "100%", height: 210 },
  imagePlaceholder: { width: "100%", height: 210, alignItems: "center", justifyContent: "center" },
  cardBody: { gap: spacing.sm, padding: spacing.md },
  price: { fontWeight: "700", fontSize: 16 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  smallButton: { minHeight: 44, minWidth: 76, borderWidth: 1, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  footer: { gap: spacing.lg, paddingTop: spacing.sm },
  manual: { gap: spacing.md, borderTopWidth: 1, paddingTop: spacing.lg },
});
