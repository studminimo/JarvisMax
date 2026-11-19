import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { TextButton } from "@/components/TextButton";
import { goalCounts, goalsInDomain } from "@/domain/board";
import { GOAL_DOMAINS, goalSummary, type GoalDomainId } from "@/domain/goals";
import { colors, radius, spacing } from "@/theme";

import { useBoard } from "../board/BoardProvider";
import { SessionNote } from "../board/SessionNote";
import { TitleForm } from "../board/TitleForm";
import { useCoach } from "../coach/CoachProvider";

export function GoalsScreen() {
  const { board, addGoal, removeGoal } = useBoard();
  const coach = useCoach();
  const counts = coach.ready
    ? coach.goals.reduce<Partial<Record<GoalDomainId, number>>>((result, goal) => {
        result[goal.domainId] = (result[goal.domainId] ?? 0) + 1;
        return result;
      }, {})
    : goalCounts(board);
  const [domainId, setDomainId] = useState<GoalDomainId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const domain = GOAL_DOMAINS.find((item) => item.id === domainId) ?? null;
  const goals = domain
    ? coach.ready
      ? coach.goals.filter((goal) => goal.domainId === domain.id)
      : goalsInDomain(board, domain.id)
    : [];

  return (
    <>
      <Screen>
        <AppText variant="overline">Direction</AppText>
        <AppText accessibilityRole="header" variant="title">
          Objectifs
        </AppText>
        <View style={styles.list}>
          {GOAL_DOMAINS.map((item, index) => {
            const summary = goalSummary(counts[item.id] ?? 0);
            return (
              <Pressable
                key={item.id}
                accessibilityLabel={`${item.label}, ${summary}`}
                accessibilityRole="button"
                onPress={() => setDomainId(item.id)}
                style={({ pressed }) => [styles.row, index > 0 && styles.separator, pressed && styles.pressed]}
              >
                <View style={styles.copy}>
                  <AppText variant="body">{item.label}</AppText>
                  <AppText variant="muted">{summary}</AppText>
                </View>
                <AppText style={styles.link} variant="label">
                  Voir
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Screen>
      <Sheet onClose={() => setDomainId(null)} title={domain?.label ?? "Objectif"} visible={domain !== null}>
        {domain ? (
          <>
            {error ? <AppText variant="muted">{error}</AppText> : null}
            {goals.length === 0 ? <AppText variant="muted">Aucun objectif dans ce domaine.</AppText> : null}
            {goals.map((goal) => (
              <View key={goal.id} style={styles.goal}>
                <AppText variant="body">{goal.title}</AppText>
                <TextButton
                  accessibilityLabel={`Retirer, ${goal.title}`}
                  label="Retirer"
                  onPress={() => {
                    if (coach.ready) {
                      void coach.deleteGoal(goal.id).then(setError);
                      return;
                    }
                    const result = removeGoal(goal.id);
                    setError(result.ok ? null : result.error);
                  }}
                />
              </View>
            ))}
            {coach.ready ? null : <SessionNote />}
            <TitleForm
              action="Ajouter"
              label="Nouvel objectif"
              onSubmit={(title) => (coach.ready && domain ? coach.addGoal({ title, domainId: domain.id }) : addGoal({ title, domainId: domain?.id ?? "personal" }))}
              placeholder="Lire vingt pages"
            />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  row: {
    minHeight: 64,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  separator: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  link: {
    color: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  goal: {
    gap: 2,
  },
});
