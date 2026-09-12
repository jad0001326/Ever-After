import { addTablePlanGuests, parseTablePlanGuestNames, removeTablePlanGuest, searchTablePlanGuests, TablePlanGuestValidationError, updateTablePlanGuest } from "@everaft/planning-domain/table-plan/guest-management";
import { getGuestRsvpStatus } from "@everaft/planning-domain/table-plan/guests";
import type { TablePlan, TablePlanGuest } from "@everaft/planning-domain/table-plan/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "../../design/use-app-theme";
import { ActionButton } from "../../design/ActionButton";
import { radius, spacing, typography } from "../../design/tokens";
import type { ConnectedTablePlanMutationResult } from "../../planning/ConnectedPlanningProvider";

type Props = {
  plan: TablePlan;
  saving: boolean;
  onBack(): void;
  onSave(plan: TablePlan): Promise<ConnectedTablePlanMutationResult>;
  connectionStatus?: "device_only" | "checking" | "connected" | "needs_attention";
  onReviewConnection?(): void;
};

export function GuestListScreen({ plan, saving, onBack, onSave, connectionStatus = "device_only", onReviewConnection }: Props) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const [names, setNames] = useState("");
  const [editing, setEditing] = useState<TablePlanGuest | null>(null);
  const [editBase, setEditBase] = useState<TablePlanGuest | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveNeedsAttention, setSaveNeedsAttention] = useState(false);
  const lock = useRef(false);
  const list = useRef<FlatList<TablePlanGuest>>(null);
  const latest = useRef({ onSave, plan, saving });
  useEffect(() => {
    latest.current = { onSave, plan, saving };
  }, [onSave, plan, saving]);
  const guests = useMemo(() => searchTablePlanGuests(plan.guests, query), [plan.guests, query]);
  const busy = saving || submitting || connectionStatus === "checking";
  const textStyle = { ...typography.body, color: colors.textMuted };
  const connectionLabel = connectionStatus === "connected" ? "Connected to My EverAft"
    : connectionStatus === "checking" ? "Checking connection"
      : connectionStatus === "needs_attention" ? "Connection needs attention" : "Device-only plan";
  const saveMessage = busy ? "Saving guests…" : message || (connectionStatus === "device_only"
    ? "Guest changes are kept on this device. They do not automatically appear in a separate web plan."
    : "Your guest list is ready to edit.");
  const inputStyle = [styles.input, { color: colors.primary, borderColor: colors.border }];

  async function save(change: () => TablePlan, complete: () => void) {
    if (lock.current || latest.current.saving) return;
    lock.current = true;
    setSubmitting(true);
    try {
      const result = await latest.current.onSave(change());
      setSaveNeedsAttention(result.outcome === "needs_attention");
      setMessage(result.outcome === "connected" ? "Saved to My EverAft."
        : result.outcome === "device_only" ? "Saved on this device."
          : result.savedOnDevice ? "Saved on this device. Cloud sync needs attention."
            : "Could not save. Your entries are still here to retry.");
      if (result.outcome !== "needs_attention" || result.savedOnDevice) complete();
    } catch (error) {
      setMessage(error instanceof TablePlanGuestValidationError ? error.message : "Could not save. Your entries are still here to retry.");
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }

  function confirmDelete(guest: TablePlanGuest) {
    Alert.alert("Delete guest?", "This removes the guest, their seat assignment and any seating rules involving them.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void save(() => {
        const currentPlan = latest.current.plan;
        const currentGuest = currentPlan.guests.find((candidate) => candidate.id === guest.id);
        if (!currentGuest || !sameGuest(currentGuest, guest)) {
          throw new TablePlanGuestValidationError("This guest changed while you were confirming deletion. Review the latest guest list and try again.");
        }
        return removeTablePlanGuest(currentPlan, guest.id);
      }, () => setEditing(null)); } },
    ]);
  }

  function editedPlan() {
    if (!editing || !editBase) throw new TablePlanGuestValidationError("Choose a guest to edit.");
    const current = plan.guests.find((guest) => guest.id === editing.id);
    if (!current || current.name !== editBase.name || current.email !== editBase.email
      || current.dietaryNotes !== editBase.dietaryNotes
      || getGuestRsvpStatus(current) !== getGuestRsvpStatus(editBase)) {
      throw new TablePlanGuestValidationError("This guest changed while you were editing. Cancel and reopen the guest to review the latest details.");
    }
    return updateTablePlanGuest(plan, editing.id, editing);
  }

  return <SafeAreaView style={[styles.fill, { backgroundColor: colors.canvas }]}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <FlatList
        ref={list}
        data={guests}
        keyExtractor={(guest) => guest.id}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.form}>
          <ActionButton label="Back to plan" onPress={onBack} disabled={busy} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>Guests</Text>
          <Text style={textStyle}>{plan.guests.length} guests in your plan</Text>
          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.canvasRaised }]}>
            <Text style={[styles.connectionLabel, { color: colors.primary }]}>{connectionLabel}</Text>
            <Text accessibilityLiveRegion="polite" style={textStyle}>{saveMessage}</Text>
            {(connectionStatus === "needs_attention" || saveNeedsAttention) && onReviewConnection ? <ActionButton label="Review connection" onPress={onReviewConnection} disabled={busy} /> : null}
          </View>
          {editing ? <>
            <Text accessibilityRole="header" style={textStyle}>Edit guest</Text>
            <TextInput accessibilityLabel="Guest name" value={editing.name} editable={!busy} onChangeText={(name) => setEditing({ ...editing, name })} style={inputStyle} maxLength={160} />
            <TextInput accessibilityLabel="Guest email" value={editing.email ?? ""} editable={!busy} onChangeText={(email) => setEditing({ ...editing, email })} style={inputStyle} keyboardType="email-address" autoCapitalize="none" maxLength={320} />
            <TextInput accessibilityLabel="Dietary and accessibility notes" value={editing.dietaryNotes ?? ""} editable={!busy} onChangeText={(dietaryNotes) => setEditing({ ...editing, dietaryNotes })} style={inputStyle} multiline maxLength={2000} />
            {(["pending", "accepted", "declined"] as const).map((status) => <Pressable key={status} accessibilityRole="radio" accessibilityState={{ checked: getGuestRsvpStatus(editing) === status, disabled: busy }} disabled={busy} onPress={() => setEditing({ ...editing, rsvpStatus: status })} style={styles.button}><Text style={textStyle}>{getGuestRsvpStatus(editing) === status ? "✓ " : ""}{status}</Text></Pressable>)}
            <Text style={textStyle}>Declining clears this guest’s seat assignment.</Text>
            <ActionButton label="Save guest" primary disabled={busy} onPress={() => { void save(editedPlan, () => setEditing(null)); }} />
            <ActionButton label="Cancel editing" disabled={busy} onPress={() => setEditing(null)} />
          </> : <>
            <TextInput accessibilityLabel="Guest names to add" placeholder="One guest per line" placeholderTextColor={colors.textMuted} value={names} editable={!busy} onChangeText={setNames} style={inputStyle} multiline />
            <ActionButton label="Add guests" primary disabled={busy} onPress={() => { void save(() => addTablePlanGuests(plan, parseTablePlanGuestNames(names)), () => setNames("")); }} />
          </>}
          <TextInput accessibilityLabel="Search guests" value={query} onChangeText={setQuery} style={inputStyle} placeholder="Search name or email" placeholderTextColor={colors.textMuted} />
        </View>}
        ListEmptyComponent={<Text style={textStyle}>{query ? "No matching guests." : "Add your first guests above."}</Text>}
        renderItem={({ item }) => <View style={[styles.card, { borderColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontWeight: "700" }}>{item.name}</Text>
          <Text style={textStyle}>{getGuestRsvpStatus(item)} · {item.tableId ? "Seated" : "Unseated"}</Text>
          {item.dietaryNotes ? <Text style={textStyle}>Dietary note added</Text> : null}
          <ActionButton label={`Edit ${item.name}`} disabled={busy} onPress={() => {
            setEditing({ ...item });
            setEditBase({ ...item });
            list.current?.scrollToOffset({ offset: 0, animated: true });
          }} />
          <ActionButton label={`Delete ${item.name}`} disabled={busy} onPress={() => confirmDelete(item)} />
        </View>}
      />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function sameGuest(left: TablePlanGuest, right: TablePlanGuest) {
  return left.id === right.id
    && left.name === right.name
    && left.email === right.email
    && left.dietaryNotes === right.dietaryNotes
    && getGuestRsvpStatus(left) === getGuestRsvpStatus(right)
    && left.tableId === right.tableId
    && left.seatIndex === right.seatIndex;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  form: { gap: spacing.md },
  title: { ...typography.display, fontSize: 32, lineHeight: 40 },
  connectionLabel: { ...typography.label },
  input: { ...typography.body, borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm, minHeight: 48 },
  button: { minHeight: 48, justifyContent: "center", paddingVertical: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
});
