import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextButton } from "@/components/TextButton";
import { useMinuteClock } from "@/components/useMinuteClock";
import { TITLE_LIMIT, type Board, type BoardTask, type Recurrence } from "@/domain/board";
import { type Result } from "@/domain/result";
import { formatLongDate, parseClock, zonedParts } from "@/domain/time";
import { useActiveIdentity } from "@/features/account/useActiveIdentity";
import { colors, spacing } from "@/theme";

import { useBoard } from "./BoardProvider";

type PriorityChoice = "normal" | "priority";

const PRIORITY_OPTIONS: readonly { value: PriorityChoice; label: string }[] = [
  { value: "normal", label: "Normale" },
  { value: "priority", label: "Prioritaire" },
];

const RECURRENCE_OPTIONS: readonly { value: Recurrence; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "daily", label: "Jour" },
  { value: "weekly", label: "Semaine" },
  { value: "weekdays", label: "Ouvrés" },
];

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Aucune",
  daily: "Chaque jour",
  weekly: "Chaque semaine",
  weekdays: "Jours ouvrés",
};

export type TaskDraft = {
  title: string;
  priority: boolean;
  dueTime: string | null;
  recurrence: Recurrence;
  context: string;
};

type FormProps = {
  dateKey: string;
  initialPriority?: boolean;
  lockPriority?: boolean;
  onCreate: (draft: TaskDraft) => Result<Board> | Promise<Result<Board>>;
};

export function TaskForm({ dateKey, initialPriority = false, lockPriority = false, onCreate }: FormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<PriorityChoice>(initialPriority ? "priority" : "normal");
  const [dueTime, setDueTime] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const clock = dueTime.trim() === "" ? null : parseClock(dueTime);
  const timeInvalid = dueTime.trim() !== "" && clock === null;
  const ready = title.trim().length > 0 && !timeInvalid && !pending;

  return (
    <View style={styles.form}>
      <AppText variant="muted">{formatLongDate(dateKey)}</AppText>
      <Field
        label="Titre"
        maxLength={TITLE_LIMIT}
        onChangeText={(value) => {
          setTitle(value);
          setError(null);
        }}
        placeholder="Appeler le médecin"
        value={title}
      />
      <Field
        autoCapitalize="none"
        label="Heure"
        maxLength={5}
        onChangeText={(value) => {
          setDueTime(value);
          setError(null);
        }}
        placeholder="09:00, facultatif"
        value={dueTime}
      />
      {timeInvalid ? <AppText variant="muted">Heure invalide</AppText> : null}
      <Field
        label="Contexte"
        maxLength={TITLE_LIMIT}
        onChangeText={setContext}
        placeholder="Facultatif"
        value={context}
      />
      {lockPriority ? (
        <AppText variant="muted">Cette tâche sera prioritaire.</AppText>
      ) : (
        <SegmentedControl onChange={setPriority} options={PRIORITY_OPTIONS} value={priority} />
      )}
      <SegmentedControl onChange={setRecurrence} options={RECURRENCE_OPTIONS} value={recurrence} />
      {error ? (
        <AppText style={styles.error} variant="muted">
          {error}
        </AppText>
      ) : null}
      {pending ? <AppText variant="muted">Enregistrement.</AppText> : null}
      {ready ? (
        <PrimaryButton
          label="Ajouter"
          onPress={() => {
            setPending(true);
            void Promise.resolve(
              onCreate({
                title,
                priority: lockPriority || priority === "priority",
                dueTime: clock,
                recurrence,
                context,
              }),
            ).then(
              (result) => {
                setPending(false);
                if (result.ok) {
                  setTitle("");
                  setDueTime("");
                  setContext("");
                  setError(null);
                  return;
                }
                setError(result.error);
              },
              () => {
                setPending(false);
                setError("Le serveur n’a pas répondu.");
              },
            );
          }}
        />
      ) : null}
    </View>
  );
}

export function TaskEditor({
  task,
  showDate = false,
  onRemoved,
}: {
  task: BoardTask;
  showDate?: boolean;
  onRemoved?: () => void;
}) {
  const { toggleTask, setTaskPriority, removeTask, postponeTask, shiftTaskMinutes, ignoreTask, setRecurrence } =
    useBoard();
  const now = useMinuteClock();
  const { timeZone } = useActiveIdentity();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const meta = [
    showDate ? formatLongDate(task.dateKey) : null,
    task.dueTime,
    task.priority ? "Prioritaire" : null,
    task.done ? "Terminée" : null,
    task.recurrence !== "none" ? RECURRENCE_LABEL[task.recurrence] : null,
    task.ignoredOn === task.dateKey ? "Rappel ignoré ce jour" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  function run(work: Promise<Result<Board>>, after?: () => void) {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    void work.then(
      (result) => {
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        after?.();
      },
      () => {
        setPending(false);
        setError("Le serveur n’a pas répondu.");
      },
    );
  }

  return (
    <View style={styles.item}>
      <AppText style={task.done ? styles.done : undefined} variant="body">
        {task.title}
      </AppText>
      {task.context ? <AppText variant="muted">{task.context}</AppText> : null}
      {meta ? <AppText variant="muted">{meta}</AppText> : null}
      {error ? (
        <AppText style={styles.error} variant="muted">
          {error}
        </AppText>
      ) : null}
      {pending ? <AppText variant="muted">Enregistrement.</AppText> : null}
      {!pending ? (
        <View style={styles.actions}>
          <TextButton
            accessibilityLabel={`${task.done ? "Marquer à faire" : "Marquer terminée"}, ${task.title}`}
            label={task.done ? "Marquer à faire" : "Marquer terminée"}
            onPress={() => run(toggleTask(task.id), task.done ? undefined : undefined)}
          />
          <TextButton
            accessibilityLabel={`${task.priority ? "Retirer la priorité" : "Marquer prioritaire"}, ${task.title}`}
            label={task.priority ? "Retirer la priorité" : "Marquer prioritaire"}
            onPress={() => run(setTaskPriority(task.id, !task.priority))}
          />
          {!task.done ? (
            <>
              <TextButton
                label="+15 min"
                onPress={() => run(shiftTaskMinutes(task.id, 15, zonedParts(now, timeZone)))}
              />
              <TextButton
                label="+1 h"
                onPress={() => run(shiftTaskMinutes(task.id, 60, zonedParts(now, timeZone)))}
              />
              <TextButton label="Plus tard" onPress={() => run(postponeTask(task.id))} />
              {task.ignoredOn !== task.dateKey ? (
                <TextButton label="Ignorer" onPress={() => run(ignoreTask(task.id))} />
              ) : null}
              {RECURRENCE_OPTIONS.filter((option) => option.value !== task.recurrence).map((option) => (
                <TextButton
                  key={option.value}
                  label={RECURRENCE_LABEL[option.value]}
                  onPress={() => run(setRecurrence(task.id, option.value))}
                />
              ))}
            </>
          ) : null}
          <TextButton
            accessibilityLabel={`Retirer, ${task.title}`}
            label="Retirer"
            onPress={() => run(removeTask(task.id), onRemoved)}
          />
        </View>
      ) : null}
    </View>
  );
}

export function TaskSummary({
  task,
  onPress,
  onLongPress,
}: {
  task: BoardTask;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const meta = [
    task.dueTime,
    task.priority ? "Prioritaire" : null,
    task.done ? "Terminée" : null,
    task.recurrence !== "none" ? RECURRENCE_LABEL[task.recurrence] : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <Pressable
      accessibilityHint={onLongPress ? "Maintiens pour déplacer" : undefined}
      accessibilityLabel={meta ? `${task.title}, ${meta}` : task.title}
      accessibilityRole="button"
      delayLongPress={400}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
    >
      <AppText style={task.done ? styles.done : undefined} variant="body">
        {task.title}
      </AppText>
      {meta ? <AppText variant="muted">{meta}</AppText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  error: {
    color: colors.accent,
  },
  item: {
    gap: 2,
    paddingTop: spacing.sm,
  },
  done: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  summary: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
