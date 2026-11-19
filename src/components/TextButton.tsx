import { Pressable, StyleSheet } from "react-native";

import { colors } from "@/theme";

import { AppText } from "./AppText";

type Props = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function TextButton({ label, onPress, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
    >
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingRight: 8,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    color: colors.accent,
  },
});
