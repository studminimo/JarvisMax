import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useTodayKey } from "@/components/useTodayKey";
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  buildWeek,
  entriesOnDate,
  type CalendarCell,
  type CalendarView,
  type DatedEntry,
} from "@/domain/calendar";
import { addDays, formatLongDate, formatMonthTitle, formatWeekTitle } from "@/domain/time";
import { colors, radius } from "@/theme";

const VIEWS: readonly { value: CalendarView; label: string }[] = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
];

type Props = {
  entries?: readonly DatedEntry[];
};

export function PlanningScreen({ entries = [] }: Props) {
  const todayKey = useTodayKey();
  const [view, setView] = useState<CalendarView>("day");
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const selectedEntries = entriesOnDate(entries, selectedKey);
  const periodTitle =
    view === "day"
      ? formatLongDate(selectedKey)
      : view === "week"
        ? formatWeekTitle(selectedKey)
        : formatMonthTitle(selectedKey);
  const cells = view === "week" ? buildWeek(selectedKey, todayKey) : buildMonthGrid(selectedKey, todayKey);

  return (
    <Screen>
      <AppText variant="overline">Planning</AppText>
      <AppText accessibilityRole="header" variant="headline">
        {periodTitle}
      </AppText>
      <SegmentedControl onChange={setView} options={VIEWS} value={view} />
      {view === "day" ? (
        <View style={styles.actions}>
          <TextAction label="Veille" onPress={() => setSelectedKey((current) => addDays(current, -1))} />
          <TextAction label="Aujourd’hui" onPress={() => setSelectedKey(todayKey)} />
          <TextAction label="Lendemain" onPress={() => setSelectedKey((current) => addDays(current, 1))} />
        </View>
      ) : (
        <View>
          <View style={styles.weekHeader}>
            {WEEKDAY_LABELS.map((label) => (
              <View key={label} style={styles.headerCell}>
                <AppText variant="label">{label}</AppText>
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((cell) => (
              <DayCell
                key={cell.dateKey}
                cell={cell}
                marked={entriesOnDate(entries, cell.dateKey).length > 0}
                onPress={setSelectedKey}
                selected={cell.dateKey === selectedKey}
              />
            ))}
          </View>
        </View>
      )}
      <Card title="Au programme">
        {selectedEntries.length === 0 ? (
          <AppText variant="muted">Rien de prévu.</AppText>
        ) : (
          selectedEntries.map((entry) => (
            <AppText key={entry.id} variant="body">
              {entry.title}
            </AppText>
          ))
        )}
      </Card>
    </Screen>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <AppText variant="label" style={styles.actionLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

function DayCell({
  cell,
  selected,
  marked,
  onPress,
}: {
  cell: CalendarCell;
  selected: boolean;
  marked: boolean;
  onPress: (dateKey: string) => void;
}) {
  let label = formatLongDate(cell.dateKey);
  if (cell.isToday) {
    label += ", aujourd’hui";
  }
  if (selected) {
    label += ", sélectionné";
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(cell.dateKey)}
      style={styles.cell}
    >
      <View style={[styles.bullet, selected && styles.bulletSelected, !selected && cell.isToday && styles.bulletToday]}>
        <AppText
          variant="label"
          style={[
            styles.day,
            !cell.inCurrentMonth && styles.outside,
            cell.isToday && !selected && styles.today,
            selected && styles.daySelected,
          ]}
        >
          {cell.dayOfMonth}
        </AppText>
      </View>
      {marked ? <View style={[styles.mark, selected && styles.markSelected]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  action: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  actionLabel: {
    color: colors.accent,
  },
  pressed: {
    opacity: 0.6,
  },
  weekHeader: {
    flexDirection: "row",
  },
  headerCell: {
    width: "14.2857%",
    alignItems: "center",
    paddingBottom: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "14.2857%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bullet: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletSelected: {
    backgroundColor: colors.accent,
  },
  bulletToday: {
    borderColor: colors.accent,
    borderWidth: 1,
  },
  day: {
    color: colors.text,
  },
  outside: {
    color: colors.outside,
  },
  today: {
    color: colors.accent,
  },
  daySelected: {
    color: colors.onAccent,
  },
  mark: {
    position: "absolute",
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  markSelected: {
    backgroundColor: colors.onAccent,
  },
});
