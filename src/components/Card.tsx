import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { colors, radius, spacing } from "@/theme";

import { AppText } from "./AppText";

type Props = {
  title: string;
  children: ReactNode;
  delay?: number;
};

export function Card({ title, children, delay = 0 }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(320).delay(delay)} style={styles.card}>
      <AppText variant="label">{title}</AppText>
      <View style={styles.content}>{children}</View>
    </Animated.View>
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
});
