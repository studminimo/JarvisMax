import { Link, Stack } from "expo-router";
import { StyleSheet } from "react-native";

import { AppText } from "@/components/AppText";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Introuvable" }} />
      <Screen edges={["left", "right", "bottom"]}>
        <AppText accessibilityRole="header" variant="title">
          Cette page n’existe pas.
        </AppText>
        <Link href="/" style={styles.link}>
          <AppText variant="body" style={styles.linkText}>
            Retour à l’accueil
          </AppText>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 44,
    justifyContent: "center",
  },
  linkText: {
    color: colors.accent,
  },
});
