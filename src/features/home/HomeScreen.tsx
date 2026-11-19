import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { TextButton } from "@/components/TextButton";
import { useMinuteClock } from "@/components/useMinuteClock";
import { useTodayKey } from "@/components/useTodayKey";
import { boardToHome, greetingLine, openTasks, priorityTasks, tasksOnDate, type BoardTask } from "@/domain/board";
import { homeCards, priorityOnly, showsRoutine, showsTimer } from "@/domain/coach";
import { describeHome, type ListLine, type TextLine } from "@/domain/home";
import { formatClock, formatLongDate, greetingForHour, zonedParts } from "@/domain/time";
import { useActiveIdentity } from "@/features/account/useActiveIdentity";
import { colors } from "@/theme";

import { useAccount } from "../account/AccountProvider";
import { useBoard } from "../board/BoardProvider";
import { SessionNote } from "../board/SessionNote";
import { TaskEditor, TaskForm } from "../board/TaskControls";
import { TitleForm } from "../board/TitleForm";
import { DayNote } from "../coach/DayNote";
import { MinuteTimer } from "../coach/MinuteTimer";
import { ModeBar } from "../coach/ModeBar";
import { RoutinePanel } from "../coach/RoutinePanel";
import { useCoach } from "../coach/CoachProvider";

type SheetKey = "next" | "day" | "priorities" | "habits" | "progress";

const SHEET_TITLES: Record<SheetKey, string> = {
  next: "Prochaine tâche",
  day: "Aujourd’hui",
  priorities: "Priorités",
  habits: "Habitudes du jour",
  progress: "Progression",
};

export function HomeScreen() {
  const now = useMinuteClock();
  const account = useAccount();
  const { givenName, timeZone } = useActiveIdentity();
  const todayKey = useTodayKey(timeZone);
  const { board, addTask, addHabit, toggleHabit, removeHabit } = useBoard();
  const coach = useCoach();
  const signedIn = account.status.kind === "signed_in";
  const source = coach.ready
    ? { ...board, habits: coach.habits.map((habit) => ({ id: habit.id, title: habit.title, done: habit.done })) }
    : board;
  const copy = describeHome(boardToHome(source, todayKey));
  const cards = homeCards(coach.mode);
  const nextOnly = priorityOnly(coach.mode);
  const nextTitle = nextOnly ? (priorityTasks(board)[0]?.title ?? null) : copy.nextTask.text;
  const nextLine = nextOnly
    ? { filled: Boolean(nextTitle), text: nextTitle ?? "Aucune priorité. Le reste peut attendre." }
    : copy.nextTask;
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const todayTasks = tasksOnDate(board, todayKey);
  const habits = coach.ready ? coach.habits : board.habits;
  const nextTasks = nextOnly ? priorityTasks(board) : openTasks(board);

  return (
    <>
      <Screen>
        <View style={styles.header}>
          <AppText variant="overline">Jarvis</AppText>
          <AppText accessibilityRole="header" variant="title">
            {greetingLine(greetingForHour(zonedParts(now, timeZone).hour), givenName)}
          </AppText>
          <AppText variant="muted">{formatLongDate(todayKey, timeZone)}</AppText>
          <AppText variant="clock">{formatClock(now, timeZone)}</AppText>
        </View>
        {coach.notice ? <AppText variant="muted">{coach.notice}</AppText> : null}
        <ModeBar
          mode={coach.mode}
          onChange={(mode) => {
            void coach.setMode(mode).then(setActionError);
          }}
        />
        {signedIn ? null : <AppText variant="muted">Ce mode reste sur cet écran.</AppText>}
        {actionError ? <AppText variant="muted">{actionError}</AppText> : null}
        {cards.includes("next") ? <InfoCard delay={40} line={nextLine} onPress={() => setSheet("next")} title="Prochaine tâche" /> : null}
        {cards.includes("day") ? <InfoCard delay={80} line={copy.day} onPress={() => setSheet("day")} title="Aujourd’hui" /> : null}
        {cards.includes("priorities") ? <ListCard delay={120} line={copy.priorities} onPress={() => setSheet("priorities")} title="Priorités" /> : null}
        {cards.includes("habits") ? <ListCard delay={160} line={copy.habits} onPress={() => setSheet("habits")} title="Habitudes" /> : null}
        {cards.includes("progress") ? <InfoCard delay={200} line={copy.progress} onPress={() => setSheet("progress")} title="Progression" /> : null}
        {showsTimer(coach.mode) ? <MinuteTimer /> : null}
        {showsRoutine(coach.mode) ? (
          <RoutinePanel
            onAdd={(title, steps) => coach.addRoutine({ title, steps: steps.split("\n"), dueTime: null, recurrence: "daily" })}
            onToggle={(stepId, doneOn) => coach.toggleStep(stepId, doneOn)}
            ready={coach.ready}
            routines={coach.routines}
            signedIn={signedIn}
            todayKey={todayKey}
          />
        ) : null}
        {cards.includes("day") ? (
          <DayNote note={coach.note} onSave={(content) => coach.saveNote(content, todayKey)} ready={coach.ready} signedIn={signedIn} />
        ) : null}
      </Screen>
      <Sheet onClose={() => setSheet(null)} title={sheet ? SHEET_TITLES[sheet] : ""} visible={sheet !== null}>
        {sheet === "next" ? (
          <>
            <TaskList empty={nextLine.text} showDate tasks={nextTasks} />
            <SessionNote about="tasks" />
            <TaskForm
              dateKey={todayKey}
              onCreate={(draft) => addTask({ ...draft, dateKey: todayKey })}
            />
          </>
        ) : null}
        {sheet === "day" ? (
          <>
            <TaskList empty={copy.day.text} tasks={todayTasks} />
            <SessionNote about="tasks" />
            <TaskForm
              dateKey={todayKey}
              onCreate={(draft) => addTask({ ...draft, dateKey: todayKey })}
            />
          </>
        ) : null}
        {sheet === "priorities" ? (
          <>
            <TaskList empty={copy.priorities.emptyLabel} showDate tasks={priorityTasks(board)} />
            <SessionNote about="tasks" />
            <TaskForm
              dateKey={todayKey}
              lockPriority
              onCreate={(draft) => addTask({ ...draft, dateKey: todayKey, priority: true })}
            />
          </>
        ) : null}
        {sheet === "habits" ? (
          <>
            {habits.length === 0 ? <AppText variant="muted">{copy.habits.emptyLabel}</AppText> : null}
            {habits.map((habit) => (
              <View key={habit.id} style={styles.habit}>
                <AppText style={habit.done ? styles.done : undefined} variant="body">
                  {habit.title}
                </AppText>
                <View style={styles.actions}>
                  <TextButton
                    label={habit.done ? "Marquer à faire" : "Marquer faite"}
                    onPress={() => {
                      if (coach.ready) {
                        void coach.toggleHabit(habit.id, !habit.done, todayKey).then(setActionError);
                        return;
                      }
                      toggleHabit(habit.id);
                    }}
                  />
                  <TextButton
                    label="Retirer"
                    onPress={() => {
                      if (coach.ready) {
                        void coach.deleteHabit(habit.id).then(setActionError);
                        return;
                      }
                      removeHabit(habit.id);
                    }}
                  />
                </View>
              </View>
            ))}
            {coach.ready ? null : <SessionNote />}
            <TitleForm
              action="Ajouter"
              label="Nouvelle habitude"
              onSubmit={(title) => (coach.ready ? coach.addHabit(title) : addHabit(title))}
              placeholder="Marche"
            />
          </>
        ) : null}
        {sheet === "progress" ? (
          todayTasks.length === 0 ? (
            <AppText variant="muted">{copy.progress.text}</AppText>
          ) : (
            <>
              <AppText variant="body">{copy.progress.text}</AppText>
              {todayTasks.map((task) => (
                <TaskEditor key={task.id} task={task} />
              ))}
            </>
          )
        ) : null}
      </Sheet>
    </>
  );
}

function TaskList({ tasks, empty, showDate = false }: { tasks: readonly BoardTask[]; empty: string; showDate?: boolean }) {
  if (tasks.length === 0) {
    return <AppText variant="muted">{empty}</AppText>;
  }
  return (
    <>
      {tasks.map((task) => (
        <TaskEditor key={task.id} showDate={showDate} task={task} />
      ))}
    </>
  );
}

function InfoCard({
  title,
  line,
  delay,
  onPress,
}: {
  title: string;
  line: TextLine;
  delay: number;
  onPress: () => void;
}) {
  return (
    <Card delay={delay} onPress={onPress} title={title}>
      <AppText variant={line.filled ? "body" : "muted"}>{line.text}</AppText>
      <AppText style={styles.link} variant="label">
        Voir
      </AppText>
    </Card>
  );
}

function ListCard({
  title,
  line,
  delay,
  onPress,
}: {
  title: string;
  line: ListLine;
  delay: number;
  onPress: () => void;
}) {
  return (
    <Card delay={delay} onPress={onPress} title={title}>
      {line.items.length === 0 ? (
        <AppText variant="muted">{line.emptyLabel}</AppText>
      ) : (
        line.items.map((item, index) => (
          <AppText key={`${item}-${index}`} variant="body">
            {item}
          </AppText>
        ))
      )}
      <AppText style={styles.link} variant="label">
        Voir
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
    marginBottom: 4,
  },
  link: {
    color: colors.accent,
  },
  habit: {
    gap: 2,
  },
  done: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
