import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { colors, radius, spacing } from "@/theme";

import { AppText } from "./AppText";

type Props = {
  title: string;
  children: ReactNode;
  delay?: number;
  onPress?: () => void;
};

export function Card({ title, children, delay = 0, onPress }: Props) {
  const body = (
    <Animated.View entering={FadeInDown.duration(320).delay(delay)} style={styles.card}>
      <AppText variant="label">{title}</AppText>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable
      accessibilityHint="Ouvre le détail"
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  content: {
    gap: spacing.xs,
  },
  pressable: {
    alignSelf: "stretch",
  },
  pressed: {
    opacity: 0.82,
  },
});
