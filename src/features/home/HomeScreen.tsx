import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { useMinuteClock } from "@/components/useMinuteClock";
import { describeHome, type HomeSnapshot, type ListLine, type TextLine } from "@/domain/home";
import { formatClock, formatLongDate, greetingForHour, zonedDateKey, zonedParts } from "@/domain/time";

type Props = {
  snapshot: HomeSnapshot;
};

export function HomeScreen({ snapshot }: Props) {
  const now = useMinuteClock();
  const copy = describeHome(snapshot);
  const dateKey = zonedDateKey(now);

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="overline">Jarvis</AppText>
        <AppText accessibilityRole="header" variant="title">
          {greetingForHour(zonedParts(now).hour)}
        </AppText>
        <AppText variant="muted">{formatLongDate(dateKey)}</AppText>
        <AppText variant="clock">{formatClock(now)}</AppText>
      </View>
      <InfoCard delay={40} line={copy.nextTask} title="Prochaine tâche" />
      <InfoCard delay={80} line={copy.day} title="Aujourd’hui" />
      <ListCard delay={120} line={copy.priorities} title="Priorités" />
      <ListCard delay={160} line={copy.habits} title="Habitudes" />
      <InfoCard delay={200} line={copy.progress} title="Progression" />
    </Screen>
  );
}

function InfoCard({ title, line, delay }: { title: string; line: TextLine; delay: number }) {
  return (
    <Card delay={delay} title={title}>
      <AppText variant={line.filled ? "body" : "muted"}>{line.text}</AppText>
    </Card>
  );
}

function ListCard({ title, line, delay }: { title: string; line: ListLine; delay: number }) {
  return (
    <Card delay={delay} title={title}>
      {line.items.length === 0 ? (
        <AppText variant="muted">{line.emptyLabel}</AppText>
      ) : (
        line.items.map((item, index) => (
          <AppText key={`${item}-${index}`} variant="body">
            {item}
          </AppText>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: 4,
  },
});
