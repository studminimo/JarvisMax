import { type ReactNode } from "react";
import { StyleSheet, Text, type AccessibilityRole, type StyleProp, type TextStyle } from "react-native";

import { colors, fonts } from "@/theme";

type Variant = "overline" | "title" | "headline" | "clock" | "body" | "muted" | "label";

type Props = {
  children: ReactNode;
  variant?: Variant;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: AccessibilityRole;
};

export function AppText({ children, variant = "body", style, accessibilityRole }: Props) {
  return (
    <Text accessibilityRole={accessibilityRole} style={[styles[variant], style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  overline: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 34,
    lineHeight: 40,
    color: colors.text,
  },
  headline: {
    fontFamily: fonts.semibold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
  },
  clock: {
    fontFamily: fonts.semibold,
    fontSize: 40,
    lineHeight: 46,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.muted,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.3,
    color: colors.muted,
  },
});
