import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
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

import {
  weddingPriorityOptions,
  type WeddingPriority,
} from "@everaft/planning-domain/planning-workspace/profile";

import { type AppColors, radius, spacing, typography } from "../../src/design/tokens";
import { useAppTheme } from "../../src/design/use-app-theme";
import { createDevicePlan } from "../../src/planning/device-plan-model";
import { useDevicePlan } from "../../src/planning/DevicePlanProvider";

const priorityLabels: Record<WeddingPriority, string> = {
  venue: "Venue",
  guest_experience: "Guest experience",
  photography: "Photography",
  food: "Food",
  music: "Music",
  style: "Style",
  accommodation: "Accommodation",
  accessibility: "Accessibility",
  sustainability: "Sustainability",
  value: "Value for money",
};

type DateChoice = "exact" | "season" | "unknown";

export default function OnboardingScreen() {
  const router = useRouter();
  const devicePlan = useDevicePlan();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [dateChoice, setDateChoice] = useState<DateChoice>("unknown");
  const [weddingDate, setWeddingDate] = useState("");
  const [weddingSeason, setWeddingSeason] = useState("");
  const [location, setLocation] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [budget, setBudget] = useState("");
  const [priorities, setPriorities] = useState<WeddingPriority[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recoveryNotice = devicePlan.state.status === "empty" ? devicePlan.state.recoveryNotice : null;

  function continueFromBasics() {
    const guestValue = guestCount.trim() ? Number(guestCount) : null;
    if (dateChoice === "exact" && !isValidDate(weddingDate)) {
      setError("Enter the date as YYYY-MM-DD, or choose not decided yet.");
      return;
    }
    if (dateChoice === "season" && (weddingSeason.trim().length < 4 || weddingSeason.trim().length > 80)) {
      setError("Add a season and year, such as Summer 2027.");
      return;
    }
    if (guestValue !== null && (!Number.isInteger(guestValue) || guestValue < 1 || guestValue > 10_000)) {
      setError("Guest count must be a whole number between 1 and 10,000.");
      return;
    }
    if (location.trim().length > 160) {
      setError("Keep the Scottish location under 160 characters.");
      return;
    }
    setError(null);
    setStep(1);
  }

  function continueFromBudget() {
    const pounds = parseMoney(budget);
    if (pounds === null || pounds <= 0 || pounds > 10_000_000) {
      setError("Enter a working budget between £1 and £10,000,000.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function finish() {
    const pounds = parseMoney(budget);
    if (pounds === null) return;
    setSaving(true);
    setError(null);
    try {
      await devicePlan.create(createDevicePlan({
        weddingDate: dateChoice === "exact" ? weddingDate : null,
        weddingSeason: dateChoice === "season" ? weddingSeason.trim() : null,
        location: location.trim() || null,
        guestCount: guestCount.trim() ? Number(guestCount) : null,
        totalBudgetPence: Math.round(pounds * 100),
        priorities,
      }));
      router.replace("/(tabs)/today");
    } catch (cause) {
      if (__DEV__) console.error("Device plan creation failed", cause);
      setError("Your plan could not be saved. Nothing was sent to the cloud; please try again.");
    } finally {
      setSaving(false);
    }
  }

  function togglePriority(priority: WeddingPriority) {
    setPriorities((current) => current.includes(priority)
      ? current.filter((item) => item !== priority)
      : current.length < 5 ? [...current, priority] : current);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.progress}>STEP {step + 1} OF 3</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {step === 0 ? "Tell us about your day" : step === 1 ? "Shape your working budget" : "Keep this plan on your device"}
          </Text>
          <Text style={styles.body}>
            {step === 0
              ? "Unknown details are fine. You can correct everything later."
              : step === 1
                ? "Your budget and priorities guide what EverAft recommends next."
                : "This first plan works offline and is not yet backed up or shared with a partner."}
          </Text>

          {recoveryNotice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{recoveryNotice}</Text> : null}

          {step === 0 ? (
            <View style={styles.form}>
              <FieldLabel text="Wedding timing" styles={styles} />
              <View accessibilityRole="radiogroup" style={styles.choiceRow}>
                {(["exact", "season", "unknown"] as const).map((choice) => (
                  <ChoiceButton key={choice} label={choice === "exact" ? "Exact date" : choice === "season" ? "Season/year" : "Not decided"} onPress={() => setDateChoice(choice)} role="radio" selected={dateChoice === choice} styles={styles} />
                ))}
              </View>
              {dateChoice === "exact" ? <Input accessibilityLabel="Wedding date" keyboardType="numbers-and-punctuation" onChangeText={setWeddingDate} placeholder="YYYY-MM-DD" styles={styles} value={weddingDate} /> : null}
              {dateChoice === "season" ? <Input accessibilityLabel="Wedding season and year" onChangeText={setWeddingSeason} placeholder="Summer 2027" styles={styles} value={weddingSeason} /> : null}
              <FieldLabel text="Scottish location" styles={styles} />
              <Input accessibilityLabel="Scottish location" onChangeText={setLocation} placeholder="Town, council area or region" styles={styles} value={location} />
              <FieldLabel text="Expected guests" styles={styles} />
              <Input accessibilityLabel="Expected guests" keyboardType="number-pad" onChangeText={setGuestCount} placeholder="Not sure yet" styles={styles} value={guestCount} />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.form}>
              <FieldLabel text="Working budget" styles={styles} />
              <Input accessibilityLabel="Working budget in pounds" keyboardType="decimal-pad" onChangeText={setBudget} placeholder="£20,000" styles={styles} value={budget} />
              <FieldLabel text="What matters most? Choose up to five." styles={styles} />
              <View style={styles.priorityGrid}>
                {weddingPriorityOptions.map((priority) => <ChoiceButton key={priority} label={priorityLabels[priority]} onPress={() => togglePriority(priority)} role="checkbox" selected={priorities.includes(priority)} styles={styles} />)}
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View accessible accessibilityLabel="Plan storage: Saved on this device" style={styles.storageCard}>
              <Text style={styles.storageEyebrow}>PLAN STORAGE</Text>
              <Text style={styles.storageTitle}>Saved on this device</Text>
              <Text style={styles.body}>Works without a connection. Cloud recovery and partner sharing are not claimed in this version.</Text>
            </View>
          ) : null}

          {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={step === 0 ? continueFromBasics : step === 1 ? continueFromBudget : finish} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>{step === 2 ? saving ? "Saving…" : "Create my plan" : "Continue"}</Text>
            </Pressable>
            {step > 0 ? <Pressable accessibilityRole="button" onPress={() => { setError(null); setStep((current) => current - 1); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Back</Text></Pressable> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type OnboardingStyles = ReturnType<typeof createStyles>;

function FieldLabel({ text, styles }: { text: string; styles: OnboardingStyles }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

function Input({ styles, ...props }: React.ComponentProps<typeof TextInput> & { styles: OnboardingStyles }) {
  return <TextInput autoCapitalize="sentences" placeholderTextColor={styles.placeholder.color} style={styles.input} {...props} />;
}

function ChoiceButton({ label, onPress, role, selected, styles }: { label: string; onPress(): void; role: "checkbox" | "radio"; selected: boolean; styles: OnboardingStyles }) {
  return (
    <Pressable accessibilityRole={role} accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function parseMoney(value: string) {
  const normalized = value.replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { backgroundColor: colors.canvas, flex: 1 },
    content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
    progress: { ...typography.label, color: colors.accent },
    title: { ...typography.display, color: colors.primary, fontSize: 40, lineHeight: 48 },
    body: { ...typography.body, color: colors.text },
    notice: { ...typography.body, backgroundColor: colors.canvasRaised, borderRadius: radius.sm, color: colors.text, padding: spacing.md },
    form: { gap: spacing.md },
    fieldLabel: { color: colors.text, fontSize: 16, fontWeight: "700" },
    choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    priorityGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    choice: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    choiceText: { color: colors.text, fontSize: 15, fontWeight: "600" },
    choiceTextSelected: { color: colors.onPrimary },
    input: { backgroundColor: colors.canvasRaised, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, color: colors.text, fontSize: 17, minHeight: 52, paddingHorizontal: spacing.md },
    placeholder: { color: colors.textMuted },
    storageCard: { backgroundColor: colors.canvasRaised, borderRadius: radius.md, gap: spacing.sm, padding: spacing.lg },
    storageEyebrow: { ...typography.label, color: colors.accent },
    storageTitle: { ...typography.display, color: colors.primary, fontSize: 30, lineHeight: 36 },
    error: { ...typography.body, color: colors.accent, fontWeight: "700" },
    actions: { gap: spacing.sm },
    primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
    primaryText: { color: colors.onPrimary, fontSize: 17, fontWeight: "700" },
    secondaryButton: { alignItems: "center", justifyContent: "center", minHeight: 44 },
    secondaryText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
    pressed: { opacity: 0.8 },
  });
}
