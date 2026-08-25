import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { spacing, typography } from "../../src/design/tokens";
import { useAppTheme } from "../../src/design/use-app-theme";
import { useDevicePlan } from "../../src/planning/DevicePlanProvider";

export default function DevicePlanRecoveryScreen() {
  const { colors } = useAppTheme();
  const devicePlan = useDevicePlan();
  const [fixture, setFixture] = useState("");
  const [message, setMessage] = useState("Development recovery only. Fixtures can contain private planning data.");

  async function exportFixture() {
    try {
      setFixture(await devicePlan.exportRecoveryFixture());
      setMessage("Recovery fixture prepared locally. It was not uploaded.");
    } catch {
      setMessage("There is no valid device plan to export.");
    }
  }

  async function importFixture() {
    try {
      await devicePlan.importRecoveryFixture(fixture);
      setMessage("Recovery fixture imported and validated on this device.");
    } catch {
      setMessage("That recovery fixture is invalid or too large. The existing plan was not replaced.");
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>Device plan recovery</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.text }]}>{message}</Text>
        <TextInput
          accessibilityLabel="Device plan recovery fixture"
          multiline
          onChangeText={setFixture}
          placeholder="Export or paste a development fixture"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.canvasRaised, borderColor: colors.border, color: colors.text }]}
          value={fixture}
        />
        <View style={styles.actions}>
          <Action label="Export current plan" onPress={exportFixture} colors={colors} />
          <Action label="Import fixture" onPress={importFixture} colors={colors} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ label, onPress, colors }: { label: string; onPress(): void; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={[styles.buttonText, { color: colors.onPrimary }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: spacing.lg, padding: spacing.lg },
  title: { ...typography.display, fontSize: 36, lineHeight: 44 },
  body: { ...typography.body },
  input: { borderWidth: 1, minHeight: 240, padding: spacing.md, textAlignVertical: "top" },
  actions: { gap: spacing.md },
  button: { alignItems: "center", justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
  buttonText: { fontSize: 16, fontWeight: "700" },
});
