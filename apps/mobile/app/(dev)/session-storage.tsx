import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  runSessionStorageSelfTest,
  type SessionStorageSelfTestResult,
} from "../../src/auth/session-storage-self-test";
import { type AppColors, spacing, typography } from "../../src/design/tokens";
import { useAppTheme } from "../../src/design/use-app-theme";

let selfTest: Promise<SessionStorageSelfTestResult> | null = null;

function getSelfTest() {
  selfTest ??= runSessionStorageSelfTest();
  return selfTest;
}

export default function SessionStorageSelfTestScreen() {
  if (!__DEV__) return <Redirect href="/(tabs)/today" />;
  return <DevelopmentSessionStorageSelfTest />;
}

function DevelopmentSessionStorageSelfTest() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [result, setResult] = useState<SessionStorageSelfTestResult | null>(null);

  useEffect(() => {
    let active = true;
    void getSelfTest().then((next) => {
      if (active) setResult(next);
    });
    return () => { active = false; };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>Session storage check</Text>
      {result ? (
        <View accessibilityLiveRegion="polite" style={styles.results}>
          <Text style={result.outcome === "passed" ? styles.passed : styles.failed}>
            {result.outcome === "passed" ? "PASS" : "FAIL"}
          </Text>
          {result.checks.map((check) => (
            <Text key={check.id} style={styles.check}>
              {check.passed ? "✓" : "×"} {check.id}
            </Text>
          ))}
          {result.failure ? <Text style={styles.failed}>{result.failure}</Text> : null}
        </View>
      ) : (
        <View accessibilityLiveRegion="polite" style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.check}>Checking device encryption…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.canvas,
      gap: spacing.lg,
      padding: spacing.lg,
    },
    title: { ...typography.display, color: colors.primary, fontSize: 38, lineHeight: 46 },
    results: { gap: spacing.sm },
    loading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    check: { ...typography.body, color: colors.text },
    passed: { ...typography.label, color: colors.primary, fontSize: 18 },
    failed: { ...typography.label, color: colors.accent, fontSize: 18 },
  });
}
