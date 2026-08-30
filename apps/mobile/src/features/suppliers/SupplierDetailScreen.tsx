import type { CatalogueSupplierDetail } from "@everaft/api-client";
import type { PlanningHubItemStatus } from "@everaft/planning-domain/planning-hub/plan";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNativeAuth } from "../../auth/NativeAuthProvider";
import { createNativeCatalogueClient } from "../../catalogue/catalogue-runtime";
import { radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import { useConnectedPlanning } from "../../planning/ConnectedPlanningProvider";
import { addPhotographerToPlan, supplierPlanningCost } from "./supplier-plan-actions";

const statuses: { value: PlanningHubItemStatus; label: string }[] = [
  { value: "shortlisted", label: "Estimated shortlist" }, { value: "quoted", label: "Quoted" }, { value: "booked", label: "Booked" },
];

export function SupplierDetailScreen() {
  const { supplierId } = useLocalSearchParams<{ supplierId?: string }>(); const router = useRouter(); const auth = useNativeAuth(); const connected = useConnectedPlanning(); const { colors } = useAppTheme();
  const client = useMemo(() => createNativeCatalogueClient(auth.getAccessToken), [auth.getAccessToken]); const [detail, setDetail] = useState<CatalogueSupplierDetail | null>(null);
  const [status, setStatus] = useState<PlanningHubItemStatus>("shortlisted"); const [cost, setCost] = useState(""); const [message, setMessage] = useState<string | null>(null); const [loading, setLoading] = useState(Boolean(client && supplierId));
  useEffect(() => { let active = true; if (!client || !supplierId) return; void client.getSupplier("photographer", supplierId).then((value) => { if (!active) return; setDetail(value); const amount = supplierPlanningCost(value); setCost(amount ? String(Math.round(amount / 100)) : ""); }).catch(() => { if (active) setMessage("This photographer is unavailable or could not connect."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [client, supplierId]);
  async function persist() { if (!detail || !connected.data) return; const pounds = Number(cost.replace(/[^0-9.]/g, "")); try { const result = await connected.saveBudget(addPhotographerToPlan(connected.data, detail, Number.isFinite(pounds) ? Math.max(Math.round(pounds * 100), 0) : 0, status)); setMessage(result.outcome === "connected" ? `${detail.name} is in your connected plan.` : `${detail.name} is saved in your device plan.`); } catch { setMessage("Your plan changed before this update completed. Please try again."); } }
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}><ScrollView contentContainerStyle={styles.content}><Pressable accessibilityRole="button" accessibilityLabel="Back to photographer search" onPress={() => router.back()}><Text style={{ color: colors.primary }}>← Back</Text></Pressable>
    {loading ? <ActivityIndicator accessibilityLabel="Loading photographer details" /> : null}{detail ? <><>{detail.imageUrl ? <Image accessibilityLabel={`${detail.name} ${detail.visualStatus === "approved" ? "approved photograph" : "illustrated profile"}`} source={{ uri: detail.imageUrl }} style={styles.hero} /> : null}</>
    <Text style={[styles.eyebrow, { color: colors.accent }]}>PHOTOGRAPHER · {detail.baseTown}</Text><Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>{detail.name}</Text>
    <Text style={{ color: colors.textMuted }}>{detail.visualStatus === "approved" ? "Supplier-approved photography" : detail.visualStatus === "representative" ? "EverAft illustrated profile; supplier photography is awaiting approval" : "Photography is not yet available"}</Text>
    <Text style={[styles.body, { color: colors.text }]}>{detail.description || detail.summary}</Text>{detail.styles.length ? <Text style={{ color: colors.textMuted }}>{detail.styles.join(" · ")}</Text> : null}
    <Text style={[styles.notice, { color: colors.text }]}>Availability for your wedding date has not been checked. Contact the photographer before marking a booking.</Text>
    <View accessibilityRole="radiogroup" style={[styles.panel, { borderColor: colors.border }]}>{statuses.map((item) => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: status === item.value }} onPress={() => setStatus(item.value)} style={[styles.radio, { borderColor: status === item.value ? colors.accent : colors.border }]}><Text style={{ color: colors.text }}>{item.label}</Text></Pressable>)}
    <TextInput accessibilityLabel="Photographer planning cost in pounds" value={cost} onChangeText={setCost} inputMode="decimal" placeholder="Planning cost, £" style={[styles.input, { borderColor: colors.border, color: colors.text }]} /><Pressable accessibilityRole="button" onPress={() => void persist()} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontWeight: "700" }}>Add to my plan</Text></Pressable></View></> : null}
    {message || !client ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.text }]}>{message ?? "Photographer details are unavailable in this build."}</Text> : null}</ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1 }, content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xxl }, hero: { width: "100%", height: 260, borderRadius: radius.md }, eyebrow: { ...typography.label }, title: { ...typography.display, fontSize: 38, lineHeight: 44 }, body: { ...typography.body }, notice: { ...typography.body, fontWeight: "700" }, panel: { gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md }, radio: { minHeight: 50, borderWidth: 2, borderRadius: radius.sm, justifyContent: "center", padding: spacing.md }, input: { minHeight: 50, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md }, button: { minHeight: 50, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" } });
