import { StyleSheet, TextInput, View } from "react-native";

import { colors, fonts, radius, spacing } from "@/theme";

import { AppText } from "./AppText";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoComplete?: "email" | "password" | "name" | "off";
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
  textContentType?: "emailAddress" | "password" | "name" | "none";
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  multiline = false,
  autoCapitalize = "sentences",
  autoComplete,
  keyboardType = "default",
  secureTextEntry = false,
  textContentType,
}: Props) {
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={secureTextEntry ? "none" : autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={!secureTextEntry && keyboardType !== "email-address"}
        keyboardType={keyboardType}
        maxLength={maxLength}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        selectionColor={colors.accent}
        style={[styles.input, multiline && styles.multiline]}
        textAlignVertical={multiline ? "top" : "center"}
        textContentType={textContentType}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
});
