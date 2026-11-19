import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Sheet } from "@/components/Sheet";
import { TextButton } from "@/components/TextButton";
import { useTodayKey } from "@/components/useTodayKey";
import { tasksOnDate } from "@/domain/board";
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  buildWeek,
  entriesOnDate,
  shiftView,
  type CalendarCell,
  type CalendarView,
} from "@/domain/calendar";
import { formatLongDate, formatMonthTitle, formatWeekTitle } from "@/domain/time";
import { useActiveIdentity } from "@/features/account/useActiveIdentity";
import { colors, radius } from "@/theme";

import { useBoard } from "../board/BoardProvider";
import { SessionNote } from "../board/SessionNote";
import { TaskEditor, TaskForm, TaskSummary } from "../board/TaskControls";

const VIEWS: readonly { value: CalendarView; label: string }[] = [
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
];

export function PlanningScreen() {
  const { timeZone } = useActiveIdentity();
  const todayKey = useTodayKey(timeZone);
  const { board, addTask, moveTask } = useBoard();
  const [view, setView] = useState<CalendarView>("day");
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [carryId, setCarryId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const selectedTasks = tasksOnDate(board, selectedKey);
  const opened = board.tasks.find((task) => task.id === openId) ?? null;
  const periodTitle =
    view === "day"
      ? formatLongDate(selectedKey, timeZone)
      : view === "week"
        ? formatWeekTitle(selectedKey, timeZone)
        : formatMonthTitle(selectedKey, timeZone);
  const cells = view === "week" ? buildWeek(selectedKey, todayKey) : buildMonthGrid(selectedKey, todayKey);

  function chooseDay(dateKey: string) {
    if (!carryId) {
      setSelectedKey(dateKey);
      return;
    }
    void moveTask(carryId, dateKey).then((result) => {
      if (!result.ok) {
        setMoveError(result.error);
        return;
      }
      setMoveError(null);
      setCarryId(null);
      setSelectedKey(dateKey);
    });
  }

  const move = (nextView: CalendarView, direction: -1 | 1) => {
    setSelectedKey((current) => shiftView(current, nextView, direction));
  };

  return (
    <>
      <Screen>
        <AppText variant="overline">Planning</AppText>
        <AppText accessibilityRole="header" variant="headline">
          {periodTitle}
        </AppText>
        <SegmentedControl onChange={setView} options={VIEWS} value={view} />
        {view === "day" ? (
          <View style={styles.actions}>
            <TextButton label="Veille" onPress={() => move("day", -1)} />
            {selectedKey !== todayKey ? (
              <TextButton label="Aujourd’hui" onPress={() => setSelectedKey(todayKey)} />
            ) : null}
            <TextButton label="Lendemain" onPress={() => move("day", 1)} />
          </View>
        ) : (
          <View>
            <View style={styles.actions}>
              <TextButton
                accessibilityLabel={view === "week" ? "Semaine précédente" : "Mois précédent"}
                label="Précédente"
                onPress={() => move(view, -1)}
              />
              {selectedKey !== todayKey ? (
                <TextButton label="Aujourd’hui" onPress={() => setSelectedKey(todayKey)} />
              ) : null}
              <TextButton
                accessibilityLabel={view === "week" ? "Semaine suivante" : "Mois suivant"}
                label="Suivante"
                onPress={() => move(view, 1)}
              />
            </View>
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
                  marked={entriesOnDate(board.tasks, cell.dateKey).length > 0}
                  onPress={chooseDay}
                  selected={cell.dateKey === selectedKey}
                  timeZone={timeZone}
                  carrying={carryId !== null}
                />
              ))}
            </View>
          </View>
        )}
        <Card title="Au programme">
          {carryId ? (
            <AppText variant="muted">
              {view === "day" ? "Passe en semaine ou en mois, puis touche un jour." : "Touche le jour de destination."}
            </AppText>
          ) : selectedTasks.length > 0 && view !== "day" ? (
            <AppText variant="muted">Maintiens une tâche, puis touche un jour.</AppText>
          ) : null}
          {moveError ? <AppText variant="muted">{moveError}</AppText> : null}
          {carryId ? <TextButton label="Annuler le déplacement" onPress={() => setCarryId(null)} /> : null}
          {selectedTasks.length === 0 ? (
            <AppText variant="muted">Rien de prévu.</AppText>
          ) : (
            selectedTasks.map((task) => (
              <TaskSummary
                key={task.id}
                onLongPress={() => {
                  setMoveError(null);
                  setCarryId(task.id);
                }}
                onPress={() => setOpenId(task.id)}
                task={task}
              />
            ))
          )}
          <SessionNote about="tasks" />
          <TextButton label="Ajouter" onPress={() => setAdding(true)} />
        </Card>
      </Screen>
      <Sheet onClose={() => setAdding(false)} title="Ajouter" visible={adding}>
        {adding ? (
          <TaskForm
            dateKey={selectedKey}
            onCreate={(draft) => {
              return addTask({ ...draft, dateKey: selectedKey }).then((result) => {
                if (result.ok) {
                  setAdding(false);
                }
                return result;
              });
            }}
          />
        ) : null}
      </Sheet>
      <Sheet onClose={() => setOpenId(null)} title="Tâche" visible={opened !== null}>
        {opened ? <TaskEditor onRemoved={() => setOpenId(null)} showDate task={opened} /> : null}
      </Sheet>
    </>
  );
}

function DayCell({
  cell,
  selected,
  marked,
  timeZone,
  carrying,
  onPress,
}: {
  cell: CalendarCell;
  selected: boolean;
  marked: boolean;
  timeZone: string;
  carrying: boolean;
  onPress: (dateKey: string) => void;
}) {
  let label = formatLongDate(cell.dateKey, timeZone);
  if (cell.isToday) {
    label += ", aujourd’hui";
  }
  if (selected) {
    label += ", sélectionné";
  }
  if (carrying) {
    label += ", déposer";
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
