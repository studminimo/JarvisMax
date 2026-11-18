import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Screen } from "@/components/Screen";
import { GOAL_DOMAINS, type GoalDomainId, goalSummary } from "@/domain/goals";
import { colors, radius, spacing } from "@/theme";

type Props = {
  counts?: Partial<Record<GoalDomainId, number>>;
};

export function GoalsScreen({ counts = {} }: Props) {
  return (
    <Screen>
      <AppText variant="overline">Direction</AppText>
      <AppText accessibilityRole="header" variant="title">
        Objectifs
      </AppText>
      <View style={styles.list}>
        {GOAL_DOMAINS.map((domain, index) => (
          <View key={domain.id} style={[styles.row, index > 0 && styles.separator]}>
            <AppText variant="body">{domain.label}</AppText>
            <AppText variant="muted">{goalSummary(counts[domain.id] ?? 0)}</AppText>
          </View>
        ))}
      </View>
    </Screen>
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
    paddingVertical: spacing.lg,
    gap: 2,
  },
  separator: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
