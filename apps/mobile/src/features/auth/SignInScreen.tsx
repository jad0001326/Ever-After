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

import type { NativeAuthAvailability } from "../../auth/native-auth-runtime";
import { type AppColors, radius, spacing, typography } from "../../design/tokens";
import { useAppTheme } from "../../design/use-app-theme";

export function SignInScreen({
  availability,
  linkFailed = false,
  onContinueOnDevice,
  onSignIn,
}: Readonly<{
  availability: NativeAuthAvailability;
  linkFailed?: boolean;
  onContinueOnDevice(): void;
  onSignIn(email: string, password: string): Promise<void>;
}>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    linkFailed ? "That secure sign-in link could not be used. Please sign in again." : null,
  );

  async function submit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSignIn(email, password);
    } catch {
      setError("We could not sign you in. Check your details and connection, then try again.");
    } finally {
      setPassword("");
      setSubmitting(false);
    }
  }

  const configured = availability === "configured";

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>MY EVERAFT</Text>
            <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
            <Text style={styles.body}>
              Sign in to restore a connected wedding plan. You can still plan privately on this device.
            </Text>
          </View>

          {configured ? (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text nativeID="email-label" style={styles.label}>Email address</Text>
                <TextInput
                  accessibilityLabel="Email address"
                  accessibilityLabelledBy="email-label"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!submitting}
                  inputMode="email"
                  onChangeText={setEmail}
                  returnKeyType="next"
                  style={styles.input}
                  testID="email-input"
                  textContentType="emailAddress"
                  value={email}
                />
              </View>
              <View style={styles.field}>
                <Text nativeID="password-label" style={styles.label}>Password</Text>
                <TextInput
                  accessibilityLabel="Password"
                  accessibilityLabelledBy="password-label"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  editable={!submitting}
                  onChangeText={setPassword}
                  onSubmitEditing={() => { void submit(); }}
                  returnKeyType="go"
                  secureTextEntry
                  style={styles.input}
                  testID="password-input"
                  textContentType="password"
                  value={password}
                />
              </View>
              {error ? (
                <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
              ) : null}
              <Pressable
                accessibilityHint="Signs in to your connected My EverAft plan"
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => { void submit(); }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || submitting) && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? "Signing in…" : "Sign in"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View accessibilityLiveRegion="polite" style={styles.notice}>
              <Text style={styles.noticeTitle}>Connected sign-in is not active in this build</Text>
              <Text style={styles.body}>
                Nothing will be sent to the cloud. Your current prototype remains device-only.
              </Text>
            </View>
          )}

          <Pressable
            accessibilityHint="Returns to the device-only planning prototype"
            accessibilityRole="button"
            onPress={onContinueOnDevice}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Continue on this device</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    content: { flexGrow: 1, gap: spacing.xl, justifyContent: "center", padding: spacing.lg },
    heading: { gap: spacing.sm },
    eyebrow: { ...typography.label, color: colors.accent },
    title: { ...typography.display, color: colors.primary, fontSize: 44, lineHeight: 52 },
    body: { ...typography.body, color: colors.text },
    form: { gap: spacing.lg },
    field: { gap: spacing.sm },
    label: { color: colors.text, fontSize: 15, fontWeight: "600" },
    input: {
      ...typography.body,
      backgroundColor: colors.canvasRaised,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      color: colors.text,
      minHeight: 52,
      paddingHorizontal: spacing.md,
    },
    error: { ...typography.body, color: colors.accent },
    notice: {
      backgroundColor: colors.successSurface,
      borderRadius: radius.md,
      gap: spacing.sm,
      padding: spacing.md,
    },
    noticeTitle: { color: colors.primary, fontSize: 17, fontWeight: "700" },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    primaryButtonText: { color: colors.onPrimary, fontSize: 17, fontWeight: "700" },
    secondaryButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    secondaryButtonText: { color: colors.primary, fontSize: 17, fontWeight: "700" },
    pressed: { opacity: 0.78 },
  });
}
