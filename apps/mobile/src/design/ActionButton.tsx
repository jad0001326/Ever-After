import { Pressable, StyleSheet, Text } from "react-native";
import { radius, spacing } from "./tokens";
import { useAppTheme } from "./use-app-theme";

export function ActionButton({ label, onPress, disabled = false, primary = false, busy = false }: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  primary?: boolean;
  busy?: boolean;
}) {
  const { colors } = useAppTheme();
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy}
    onPress={onPress}
    style={({ pressed }) => [styles.button, {
      borderColor: colors.border,
      backgroundColor: primary ? colors.primary : colors.canvasRaised,
      opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
    }]}
  ><Text style={[styles.label, { color: primary ? colors.onPrimary : colors.primary }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 16, lineHeight: 22, fontWeight: "600", textAlign: "center" },
});
