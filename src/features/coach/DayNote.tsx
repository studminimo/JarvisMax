import { useState } from "react";
import { StyleSheet } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme";

type Props = {
  signedIn: boolean;
  ready: boolean;
  note: string;
  onSave: (content: string) => Promise<string | null>;
};

export function DayNote({ signedIn, ready, note, onSave }: Props) {
  const [draft, setDraft] = useState(note);
  const [tracked, setTracked] = useState(note);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (note !== tracked) {
    setTracked(note);
    setDraft(note);
  }

  return (
    <Card title="Note du jour">
      {!signedIn ? <AppText variant="muted">Connecte-toi pour garder la note du jour.</AppText> : null}
      {signedIn && !ready ? <AppText variant="muted">La note du jour n’est pas disponible.</AppText> : null}
      {ready ? (
        <>
          <Field
            label="Note"
            maxLength={400}
            multiline
            onChangeText={(value) => {
              setDraft(value);
              setError(null);
            }}
            placeholder="Une chose à retenir"
            value={draft}
          />
          {error ? (
            <AppText style={styles.error} variant="muted">
              {error}
            </AppText>
          ) : null}
          {pending ? <AppText variant="muted">Enregistrement.</AppText> : null}
          {draft.trim().length > 0 && draft.trim() !== note && !pending ? (
            <PrimaryButton
              label="Enregistrer"
              onPress={() => {
                setPending(true);
                void onSave(draft).then((message) => {
                  setPending(false);
                  setError(message);
                });
              }}
            />
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.accent,
  },
});
