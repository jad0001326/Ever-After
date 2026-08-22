import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { AuthSessionStatus } from "../../auth/auth-session-controller";
import type { NativeAuthAvailability } from "../../auth/native-auth-runtime";
import { type AppColors, radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";

export function YouScreen({
  availability,
  sessionStatus,
  onSignIn,
}: Readonly<{
  availability: NativeAuthAvailability;
  sessionStatus: AuthSessionStatus;
  onSignIn(): void;
}>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const authenticated = sessionStatus === "authenticated";
  const canSignIn = availability === "configured" && !authenticated;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>You</Text>
          <Text style={styles.body}>Your wedding profile, storage and account controls.</Text>
        </View>
        <View
          accessible
          accessibilityLabel="Plan storage: On this device"
          style={styles.card}
        >
          <Text style={styles.eyebrow}>PLAN STORAGE</Text>
          <Text style={styles.cardTitle}>On this device</Text>
          <Text style={styles.body}>
            {authenticated
              ? "Your My EverAft account is signed in. This plan remains device-only until a cloud workspace is loaded successfully."
              : "This prototype does not claim cloud backup or partner sharing."}
          </Text>
        </View>
        {canSignIn ? (
          <Pressable
            accessibilityHint="Opens secure My EverAft sign-in"
            accessibilityRole="button"
            onPress={onSignIn}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Sign in to My EverAft</Text>
          </Pressable>
        ) : null}
        {availability !== "configured" ? (
          <Text accessibilityLiveRegion="polite" style={styles.note}>
            Connected sign-in is not active in this local build. Device-only planning remains available.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    content: { gap: spacing.xl, padding: spacing.lg },
    heading: { gap: spacing.sm },
    title: { ...typography.display, color: colors.primary, fontSize: 44, lineHeight: 52 },
    body: { ...typography.body, color: colors.text },
    card: { backgroundColor: colors.canvasRaised, borderRadius: radius.md, gap: spacing.sm, padding: spacing.lg },
    eyebrow: { ...typography.label, color: colors.accent },
    cardTitle: { ...typography.display, color: colors.primary, fontSize: 30, lineHeight: 36 },
    button: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
    buttonText: { color: colors.onPrimary, fontSize: 17, fontWeight: "700" },
    note: { ...typography.body, color: colors.textMuted },
    pressed: { opacity: 0.78 },
  });
}
