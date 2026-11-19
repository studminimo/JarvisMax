import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TextButton } from "@/components/TextButton";
import { type Routine } from "@/domain/coach";
import { colors } from "@/theme";

type Props = {
  signedIn: boolean;
  ready: boolean;
  routines: readonly Routine[];
  todayKey: string;
  onAdd: (title: string, steps: string) => Promise<string | null>;
  onToggle: (stepId: string, doneOn: string | null) => Promise<string | null>;
};

export function RoutinePanel({ signedIn, ready, routines, todayKey, onAdd, onToggle }: Props) {
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Card title="Routines">
      {!signedIn ? <AppText variant="muted">Connecte-toi pour enregistrer une routine.</AppText> : null}
      {signedIn && !ready ? <AppText variant="muted">Les routines ne sont pas disponibles.</AppText> : null}
      {ready
        ? routines.map((routine) => (
            <View key={routine.id}>
              <AppText variant="body">{routine.title}</AppText>
              {routine.steps.map((step) => {
                const done = step.doneOn === todayKey;
                return (
                  <TextButton
                    key={step.id}
                    label={done ? `${step.title}, fait` : step.title}
                    onPress={() => {
                      void onToggle(step.id, done ? null : todayKey).then((message) => setError(message));
                    }}
                  />
                );
              })}
            </View>
          ))
        : null}
      {ready && routines.length === 0 ? <AppText variant="muted">Aucune routine.</AppText> : null}
      {error ? (
        <AppText style={styles.error} variant="muted">
          {error}
        </AppText>
      ) : null}
      {ready ? (
        <>
          <Field
            label="Titre"
            maxLength={80}
            onChangeText={(value) => {
              setTitle(value);
              setError(null);
            }}
            placeholder="Matin"
            value={title}
          />
          <Field
            label="Étapes, une par ligne"
            maxLength={400}
            multiline
            onChangeText={(value) => {
              setSteps(value);
              setError(null);
            }}
            placeholder={"Eau\nFenêtre"}
            value={steps}
          />
          {pending ? <AppText variant="muted">Enregistrement.</AppText> : null}
          {title.trim().length > 0 && steps.trim().length > 0 && !pending ? (
            <PrimaryButton
              label="Ajouter la routine"
              onPress={() => {
                setPending(true);
                void onAdd(title, steps).then((message) => {
                  setPending(false);
                  if (message) {
                    setError(message);
                    return;
                  }
                  setTitle("");
                  setSteps("");
                  setError(null);
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
