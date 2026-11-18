import { type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { logger } from "@/data/logger";
import { colors, radius, spacing } from "@/theme";

export function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error(error.message || "Erreur sans message");
  }, [error]);

  return (
    <View style={styles.container}>
      <Text style={styles.message}>L’écran a rencontré un problème.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void retry();
        }}
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
      >
        <Text style={styles.retryLabel}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  message: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
  },
  retry: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  retryLabel: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.75,
  },
});
