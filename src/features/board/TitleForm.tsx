import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TITLE_LIMIT } from "@/domain/board";
import { type Result } from "@/domain/result";
import { colors, spacing } from "@/theme";

type Props = {
  label: string;
  placeholder: string;
  action: string;
  onSubmit: (title: string) => Result<unknown> | Promise<Result<unknown>>;
};

export function TitleForm({ label, placeholder, action, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ready = title.trim().length > 0 && !pending;

  return (
    <View style={styles.form}>
      <Field
        label={label}
        maxLength={TITLE_LIMIT}
        onChangeText={(value) => {
          setTitle(value);
          setError(null);
        }}
        placeholder={placeholder}
        value={title}
      />
      {error ? (
        <AppText style={styles.error} variant="muted">
          {error}
        </AppText>
      ) : null}
      {pending ? <AppText variant="muted">Enregistrement.</AppText> : null}
      {ready ? (
        <PrimaryButton
          label={action}
          onPress={() => {
            setPending(true);
            void Promise.resolve(onSubmit(title)).then((result) => {
              setPending(false);
              if (result.ok) {
                setTitle("");
                setError(null);
                return;
              }
              setError(result.error);
            });
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  error: {
    color: colors.accent,
  },
});
