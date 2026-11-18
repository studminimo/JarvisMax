import { SymbolView } from "expo-symbols";
import { Tabs } from "expo-router";
import { type ColorValue } from "react-native";

import { colors, fonts } from "@/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 11,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color }) => <TabIcon android="home" color={color} ios="house.fill" />,
        }}
      />
      <Tabs.Screen
        name="jarvis"
        options={{
          title: "Jarvis",
          tabBarIcon: ({ color }) => <TabIcon android="auto_awesome" color={color} ios="sparkles" />,
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          title: "Planning",
          tabBarIcon: ({ color }) => <TabIcon android="calendar_today" color={color} ios="calendar" />,
        }}
      />
      <Tabs.Screen
        name="objectifs"
        options={{
          title: "Objectifs",
          tabBarIcon: ({ color }) => <TabIcon android="flag" color={color} ios="flag.fill" />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <TabIcon android="person" color={color} ios="person.fill" />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  color,
  ios,
  android,
}: {
  color: ColorValue;
  ios: "house.fill" | "sparkles" | "calendar" | "flag.fill" | "person.fill";
  android: "home" | "auto_awesome" | "calendar_today" | "flag" | "person";
}) {
  return <SymbolView name={{ ios, android, web: android }} size={22} tintColor={color ?? colors.accent} />;
}
