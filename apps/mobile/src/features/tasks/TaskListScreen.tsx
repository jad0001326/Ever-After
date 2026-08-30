import {
  getPlanningTaskCategoryLabel,
  getPlanningTaskOverview,
} from "@everaft/planning-domain/planning-workspace/tasks";
import type { PlanningTask } from "@everaft/planning-domain/planning-workspace/types";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type AppColors, radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";
import type { ConnectedTaskMutationResult } from "../../planning/ConnectedPlanningProvider";
import { nextTaskStatus } from "../../planning/task-reliability";

type TaskListScreenProps = Readonly<{
  tasks: PlanningTask[];
  storageLabel: string;
  saving: boolean;
  onBack(): void;
  onCreate(input: { title: string; dueDate: string | null }): Promise<ConnectedTaskMutationResult>;
  onChangeStatus(task: PlanningTask): Promise<ConnectedTaskMutationResult>;
  onDelete(taskId: string): Promise<ConnectedTaskMutationResult>;
}>;

export function TaskListScreen(props: TaskListScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const overview = useMemo(
    () => getPlanningTaskOverview(props.tasks, new Date()),
    [props.tasks],
  );
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = submitting || props.saving;

  async function create() {
    const trimmedTitle = title.trim();
    const trimmedDate = dueDate.trim();
    if (!trimmedTitle) {
      setMessage("Enter a task title first.");
      return;
    }
    if (trimmedDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setMessage("Use YYYY-MM-DD for the due date.");
      return;
    }
    setSubmitting(true);
    const result = await props.onCreate({
      title: trimmedTitle,
      dueDate: trimmedDate || null,
    });
    setSubmitting(false);
    setMessage(resultMessage(result));
    if (result.outcome !== "needs_attention") {
      setTitle("");
      setDueDate("");
    }
  }

  async function changeStatus(task: PlanningTask) {
    setSubmitting(true);
    const result = await props.onChangeStatus(task);
    setSubmitting(false);
    setMessage(resultMessage(result));
  }

  function confirmDelete(task: PlanningTask) {
    Alert.alert(
      "Delete task?",
      `Remove “${task.title}” from this plan?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setSubmitting(true);
            void props.onDelete(task.id).then((result) => {
              setSubmitting(false);
              setMessage(resultMessage(result));
            });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable accessibilityRole="button" onPress={props.onBack} style={styles.backButton}>
            <Text style={styles.backText}>Back to plan</Text>
          </Pressable>
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>NEXT ACTIONS</Text>
            <Text accessibilityRole="header" style={styles.title}>Wedding tasks</Text>
            <Text style={styles.body}>
              {overview.openCount} open · {overview.overdueCount} overdue · {props.storageLabel}
            </Text>
          </View>

          <View style={styles.form}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Add a task</Text>
            <TextInput
              accessibilityLabel="Task title"
              editable={!busy}
              maxLength={240}
              onChangeText={setTitle}
              placeholder="Task title"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              style={styles.input}
              value={title}
            />
            <TextInput
              accessibilityHint="Optional. Enter four digit year, two digit month and two digit day."
              accessibilityLabel="Task due date"
              editable={!busy}
              inputMode="text"
              maxLength={10}
              onChangeText={setDueDate}
              placeholder="Due date, YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={dueDate}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void create()}
              style={({ pressed }) => [styles.primaryButton, (pressed || busy) && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{busy ? "Saving…" : "Add task"}</Text>
            </Pressable>
            {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
          </View>

          <View style={styles.list}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Your tasks</Text>
            {overview.tasks.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.cardTitle}>Nothing to chase yet</Text>
                <Text style={styles.body}>Add the next real decision or deadline for your wedding.</Text>
              </View>
            ) : overview.tasks.map(({ task, urgency }) => (
              <View accessibilityLabel={`${task.title}, ${statusLabel(task.status)}, ${urgencyLabel(urgency)}`} key={task.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text accessibilityRole="header" style={styles.cardTitle}>{task.title}</Text>
                  <Text style={styles.badge}>{statusLabel(task.status)}</Text>
                </View>
                <Text style={styles.meta}>
                  {getPlanningTaskCategoryLabel(task.category)} · {task.dueDate ?? "No due date"} · {urgencyLabel(urgency)}
                </Text>
                {task.notes ? <Text style={styles.body}>{task.notes}</Text> : null}
                <View style={styles.actions}>
                  <Pressable
                    accessibilityLabel={`${statusActionLabel(task.status)}: ${task.title}`}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void changeStatus(task)}
                    style={({ pressed }) => [styles.secondaryButton, (pressed || busy) && styles.pressed]}
                  >
                    <Text style={styles.secondaryButtonText}>{statusActionLabel(task.status)}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Delete task: ${task.title}`}
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => confirmDelete(task)}
                    style={({ pressed }) => [styles.deleteButton, (pressed || busy) && styles.pressed]}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function resultMessage(result: ConnectedTaskMutationResult) {
  if (result.outcome === "connected") return "Saved to My EverAft.";
  if (result.outcome === "device_only") return "Saved on this device.";
  if (result.failure === "conflict") return "The cloud copy changed. Your device copy is safe; refresh before trying again.";
  if (result.failure === "offline") return "Your device copy is safe. Reconnect and refresh to check the cloud copy.";
  return "Your device copy is safe, but the cloud copy needs attention.";
}

function statusActionLabel(status: PlanningTask["status"]) {
  const next = nextTaskStatus(status);
  if (next === "in_progress") return "Start task";
  if (next === "done") return "Mark complete";
  return "Reopen task";
}

function statusLabel(status: PlanningTask["status"]) {
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Done";
  return "To do";
}

function urgencyLabel(urgency: ReturnType<typeof getPlanningTaskOverview>["tasks"][number]["urgency"]) {
  if (urgency === "due_soon") return "Due soon";
  if (urgency === "today") return "Due today";
  if (urgency === "overdue") return "Overdue";
  if (urgency === "unscheduled") return "Unscheduled";
  if (urgency === "done") return "Completed";
  return "Scheduled";
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    flex: { flex: 1 },
    content: { gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
    backButton: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
    backText: { color: colors.accent, fontSize: 16, fontWeight: "700" },
    heading: { gap: spacing.sm },
    eyebrow: { ...typography.label, color: colors.accent },
    title: { ...typography.display, color: colors.primary, fontSize: 40, lineHeight: 46 },
    body: { ...typography.body, color: colors.textMuted },
    form: { gap: spacing.md, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.lg },
    sectionTitle: { ...typography.display, color: colors.primary, fontSize: 28, lineHeight: 34 },
    input: { ...typography.body, backgroundColor: colors.canvasRaised, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, color: colors.text, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
    primaryButtonText: { color: colors.onPrimary, fontSize: 17, fontWeight: "700" },
    message: { ...typography.body, color: colors.text },
    list: { gap: spacing.md },
    empty: { gap: spacing.sm, backgroundColor: colors.canvasRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
    card: { gap: spacing.md, backgroundColor: colors.canvasRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
    cardHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
    cardTitle: { ...typography.display, color: colors.primary, flexShrink: 1, fontSize: 22, lineHeight: 28 },
    badge: { backgroundColor: colors.successSurface, borderRadius: radius.pill, color: colors.primary, fontSize: 12, fontWeight: "700", overflow: "hidden", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    meta: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    secondaryButton: { alignItems: "center", borderColor: colors.primary, borderRadius: radius.sm, borderWidth: 1, flexGrow: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.md },
    secondaryButtonText: { color: colors.primary, fontWeight: "700" },
    deleteButton: { alignItems: "center", borderRadius: radius.sm, justifyContent: "center", minHeight: 48, minWidth: 88, paddingHorizontal: spacing.md },
    deleteText: { color: colors.accent, fontWeight: "700" },
    pressed: { opacity: 0.72 },
  });
}
