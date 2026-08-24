import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { typography } from "../../src/design/tokens";
import { useAppTheme } from "../../src/design/use-app-theme";
import { primaryTabs, type PrimaryTabName } from "../../src/navigation/primary-tabs";

const icons: Record<PrimaryTabName, keyof typeof Ionicons.glyphMap> = {
  today: "calendar-outline",
  discover: "search-outline",
  plan: "list-outline",
  you: "person-circle-outline",
};

export default function TabLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.canvasRaised,
          borderTopColor: colors.border,
          minHeight: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          ...typography.tab,
          marginBottom: 4,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            color={color}
            name={icons[route.name as PrimaryTabName]}
            size={Math.max(size, 24)}
          />
        ),
      })}
    >
      {primaryTabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.accessibilityLabel,
          }}
        />
      ))}
    </Tabs>
  );
}
