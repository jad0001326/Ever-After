import type { CatalogueSupplier } from "@everaft/api-client";
import { calculatePlanningHubPlan, findPlanningHubVenueItem } from "@everaft/planning-domain/planning-hub/plan";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNativeAuth } from "../../auth/NativeAuthProvider";
import { createNativeCatalogueClient } from "../../catalogue/catalogue-runtime";
import { radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import { useConnectedPlanning } from "../../planning/ConnectedPlanningProvider";
import { useDevicePlan } from "../../planning/DevicePlanProvider";
import { addManualPhotographer, setSupplierSavedOnDevice, SupplierCompareLimitError, toggleComparedSupplier } from "./supplier-plan-actions";

export function SupplierDiscoveryScreen() {
  const router = useRouter(); const auth = useNativeAuth(); const device = useDevicePlan(); const connected = useConnectedPlanning(); const { colors } = useAppTheme();
  const client = useMemo(() => createNativeCatalogueClient(auth.getAccessToken), [auth.getAccessToken]);
  const data = connected.data; const [suppliers, setSuppliers] = useState<CatalogueSupplier[]>([]); const [search, setSearch] = useState("");
  const [style, setStyle] = useState(""); const [message, setMessage] = useState<string | null>(null); const [manualName, setManualName] = useState(""); const [manualCost, setManualCost] = useState("");
  const loadedFavouritesForAccount = useRef<string | null>(null);
  const initialRequestStarted = useRef(false);
  const venue = useMemo(() => data ? findPlanningHubVenueItem(data.budgetPlan, data.budgetPlan.selectedVenueId) : null, [data]);
  const remaining = data ? calculatePlanningHubPlan(data.budgetPlan).remainingPence : 0;
  const load = useCallback(async () => {
    if (!client || !data) return;
    try {
      const result = await client.searchSuppliers("photographer", { search, style,
        location: data.workspace.profile.location ?? undefined, venueId: venue?.listingId ?? undefined,
        venueName: venue?.itemName, budgetPounds: Math.max(Math.floor(remaining / 100), 1), weddingDate: data.budgetPlan.weddingDate ?? undefined });
      setSuppliers(result.suppliers);
      setMessage(result.context.venue === "stale" ? "Your chosen venue is no longer in the live catalogue. Update the venue before using venue-based matches."
        : result.suppliers.length ? "Availability is not checked; confirm your date directly with each photographer." : "No matching photographers yet. Adjust the filters or add one manually.");
    } catch { setMessage("Photography search could not connect. Your plan remains available on this device."); }
  }, [client, data, remaining, search, style, venue]);
  useEffect(() => {
    if (!client || !data || initialRequestStarted.current) return;
    initialRequestStarted.current = true;
    let active = true;
    void client.searchSuppliers("photographer", {
      location: data.workspace.profile.location ?? undefined,
      venueId: venue?.listingId ?? undefined,
      venueName: venue?.itemName,
      budgetPounds: Math.max(Math.floor(remaining / 100), 1),
      weddingDate: data.budgetPlan.weddingDate ?? undefined,
    }).then((result) => {
      if (!active) return;
      setSuppliers(result.suppliers);
      setMessage(result.context.venue === "stale"
        ? "Your chosen venue is no longer in the live catalogue. Update the venue before using venue-based matches."
        : "Availability is not checked; confirm your date directly with each photographer.");
    }).catch(() => { if (active) setMessage("Photography search could not connect. Your plan remains available on this device."); });
    return () => { active = false; };
  }, [client, data, remaining, venue]);
  useEffect(() => {
    const accountId = auth.snapshot.accountId;
    if (!client || !data || auth.snapshot.status !== "authenticated" || !accountId || loadedFavouritesForAccount.current === accountId) return;
    loadedFavouritesForAccount.current = accountId;
    let active = true;
    void client.listFavourites().then((result) => {
      if (!active) return;
      const merged = [...new Set([...data.discovery.savedSupplierIds, ...result.supplierIds])];
      if (merged.length !== data.discovery.savedSupplierIds.length) return device.save({ ...data, discovery: { ...data.discovery, savedSupplierIds: merged } });
    }).catch(() => { if (active) setMessage("Cloud bookmarks could not refresh; device-saved photographers remain available."); });
    return () => { active = false; };
  }, [auth.snapshot.accountId, auth.snapshot.status, client, data, device]);

  async function save(supplier: CatalogueSupplier) { if (!data) return; const saved = !data.discovery.savedSupplierIds.includes(supplier.id); await device.save(setSupplierSavedOnDevice(data, supplier.id, saved));
    if (auth.snapshot.status === "authenticated" && client) { try { await client.setFavourite("supplier", supplier.id, saved); } catch { setMessage("Saved on this device; cloud bookmark sync needs attention."); } } }
  async function compare(supplier: CatalogueSupplier) { if (!data) return; try { await device.save(toggleComparedSupplier(data, supplier)); } catch (error) { setMessage(error instanceof SupplierCompareLimitError ? error.message : "Comparison could not be updated."); } }
  async function addManual() { if (!data) return; const pounds = Number(manualCost.replace(/[^0-9.]/g, "")); try { const result = await connected.saveBudget(addManualPhotographer(data, manualName, Number.isFinite(pounds) ? Math.round(pounds * 100) : 0)); setManualName(""); setManualCost(""); setMessage(result.outcome === "connected" ? "Manual photographer added to your connected plan." : "Manual photographer saved on this device."); } catch (error) { setMessage(error instanceof Error ? error.message : "Enter a photographer name."); } }
  if (!data) return null;
  return <FlatList contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]} data={suppliers} keyExtractor={(item) => item.id}
    ListHeaderComponent={<View style={styles.section}><Text style={[styles.eyebrow, { color: colors.accent }]}>NEXT FOR YOUR DAY</Text><Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>Find your photographer</Text>
      <Text style={{ color: colors.textMuted }}>{venue ? `Shaped by ${venue.itemName}, your location and remaining budget.` : "Shaped by your location and remaining budget."}</Text>
      <TextInput accessibilityLabel="Photographer name" value={search} onChangeText={setSearch} placeholder="Photographer name" style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
      <TextInput accessibilityLabel="Photography style" value={style} onChangeText={setStyle} placeholder="Style, for example Documentary" style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
      <Pressable accessibilityRole="button" onPress={() => client && data ? void load() : setMessage("Photography search is not configured in this build yet.")} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Search photographers</Text></Pressable>
      {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>{message}</Text> : null}
      {data.discovery.comparedSuppliers.length ? <Text style={[styles.compare, { color: colors.primary }]}>Comparing {data.discovery.comparedSuppliers.map((item) => item.name).join(" · ")}</Text> : null}</View>}
    renderItem={({ item }) => <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.canvasRaised }]}>
      {item.imageUrl ? <Image accessibilityLabel={`${item.name} ${item.visualStatus === "approved" ? "approved photograph" : "illustrated profile"}`} source={{ uri: item.imageUrl }} style={styles.image} /> : <View accessibilityLabel={`${item.name} photograph not yet available`} style={[styles.imagePlaceholder, { backgroundColor: colors.successSurface }]}><Text style={{ color: colors.primary, fontWeight: "700" }}>Photography coming soon</Text></View>}
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.primary }]}>{item.name}</Text><Text style={{ color: colors.textMuted }}>{item.baseTown}, {item.region}</Text><Text style={{ color: colors.text }}>{item.summary}</Text>
      <Text style={{ color: colors.textMuted }}>{item.visualStatus === "approved" ? "Supplier-approved photography" : item.visualStatus === "representative" ? "EverAft illustrated profile" : "Supplier photography is not yet available"}</Text>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{item.startingPricePence === null ? "Ask for pricing" : `Packages from ${money(item.startingPricePence)}`}</Text>
      <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/supplier/[supplierId]", params: { supplierId: item.id } })}><Text style={{ color: colors.primary }}>View</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void save(item)}><Text style={{ color: colors.primary }}>{data.discovery.savedSupplierIds.includes(item.id) ? "Saved" : "Save"}</Text></Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: data.discovery.comparedSuppliers.some((candidate) => candidate.id === item.id) }} onPress={() => void compare(item)}><Text style={{ color: colors.primary }}>Compare</Text></Pressable></View></View>}
    ListFooterComponent={<View style={styles.section}><Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.primary }]}>Photographer not listed?</Text><TextInput accessibilityLabel="Manual photographer name" value={manualName} onChangeText={setManualName} placeholder="Photographer name" style={[styles.input, { borderColor: colors.border, color: colors.text }]} /><TextInput accessibilityLabel="Manual photographer estimate in pounds" value={manualCost} onChangeText={setManualCost} inputMode="decimal" placeholder="Estimated cost, £" style={[styles.input, { borderColor: colors.border, color: colors.text }]} /><Pressable accessibilityRole="button" onPress={() => void addManual()} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Add manually</Text></Pressable></View>} />;
}
function money(value: number) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value / 100); }
const styles = StyleSheet.create({ content: { flexGrow: 1, padding: spacing.md, paddingBottom: 120 }, section: { gap: spacing.md, paddingVertical: spacing.lg }, eyebrow: { ...typography.label }, title: { ...typography.display, fontSize: 38, lineHeight: 44 }, input: { minHeight: 50, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md }, button: { minHeight: 50, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }, compare: { fontWeight: "700" }, card: { gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }, image: { width: "100%", height: 210, borderRadius: radius.sm }, imagePlaceholder: { width: "100%", height: 210, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" }, cardTitle: { ...typography.display, fontSize: 24, lineHeight: 30 }, actions: { flexDirection: "row", gap: spacing.lg, minHeight: 44, alignItems: "center" } });
