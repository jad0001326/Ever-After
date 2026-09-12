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
  storageLabel = "On this device",
  connectionMessage,
  onConnect,
  onRefresh,
  onAcceptCloudCopy,
  onKeepDeviceCopy,
}: Readonly<{
  availability: NativeAuthAvailability;
  sessionStatus: AuthSessionStatus;
  onSignIn(): void;
  storageLabel?: string;
  connectionMessage?: string;
  onConnect?(): void;
  onRefresh?(): void;
  onAcceptCloudCopy?(): void;
  onKeepDeviceCopy?(): void;
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
          accessibilityLabel={`Plan storage: ${storageLabel}`}
          style={styles.card}
        >
          <Text style={styles.eyebrow}>PLAN STORAGE</Text>
          <Text style={styles.cardTitle}>{storageLabel}</Text>
          <Text style={styles.body}>
            {connectionMessage ?? (authenticated
              ? "You are signed in. This plan stays on this device until My EverAft finishes connecting."
              : "Your plan is saved on this device. Cloud backup and partner access are not active.")}
          </Text>
        </View>
        {onConnect ? (
          <Pressable accessibilityRole="button" onPress={onConnect} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Connect this plan</Text>
          </Pressable>
        ) : null}
        {onRefresh ? (
          <Pressable accessibilityRole="button" onPress={onRefresh} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Refresh connected plan</Text>
          </Pressable>
        ) : null}
        {onAcceptCloudCopy && onKeepDeviceCopy ? (
          <View accessibilityLiveRegion="polite" style={styles.recoveryCard}>
            <Text accessibilityRole="header" style={styles.recoveryTitle}>Choose which plan to keep</Text>
            <Text style={styles.body}>
              Both copies are safe until you choose. We will check My EverAft again before making any change.
            </Text>
            <Pressable
              accessibilityHint="Replaces only conflicted items on this device with the latest My EverAft copy"
              accessibilityRole="button"
              onPress={onAcceptCloudCopy}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Use My EverAft copy</Text>
            </Pressable>
            <Pressable
              accessibilityHint="Checks the latest cloud versions before replacing conflicted My EverAft items"
              accessibilityRole="button"
              onPress={onKeepDeviceCopy}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>Keep this device copy</Text>
            </Pressable>
          </View>
        ) : null}
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
            Account sign-in is unavailable here. You can keep planning on this device.
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
    recoveryCard: { backgroundColor: colors.canvasRaised, borderColor: colors.accent, borderRadius: radius.md, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
    recoveryTitle: { ...typography.display, color: colors.primary, fontSize: 26, lineHeight: 32 },
    button: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
    buttonText: { color: colors.onPrimary, fontSize: 17, fontWeight: "700" },
    secondaryButton: { alignItems: "center", borderColor: colors.primary, borderRadius: radius.sm, borderWidth: 1, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
    secondaryButtonText: { color: colors.primary, fontSize: 17, fontWeight: "700" },
    note: { ...typography.body, color: colors.textMuted },
    pressed: { opacity: 0.78 },
  });
}
