import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { Platform } from "react-native";

import { getSupabase } from "@/data/supabase/client";
import { savePushPlan } from "@/data/supabase/push";
import { deleteTask, loadTasks, saveNewTask, saveTask, supabaseTaskStore } from "@/data/supabase/tasks";
import * as boardState from "@/domain/board";
import { type Board, type BoardTask, type Recurrence } from "@/domain/board";
import { type GoalDomainId } from "@/domain/goals";
import { planReminders } from "@/domain/reminders";
import { err, type Result } from "@/domain/result";

import { useAccount } from "../account/AccountProvider";
import { requestReminderAccess, syncReminders, type ReminderSync } from "../reminders/device";
import { enableWebReminders, inspectWebReminders } from "../reminders/web";

type TaskInput = {
  title: string;
  dateKey: string;
  priority: boolean;
  dueTime?: string | null;
  recurrence?: Recurrence;
  context?: string;
};

export type TaskSync = "session" | "loading" | "account" | "unavailable";

type BoardApi = {
  board: Board;
  taskSync: TaskSync;
  reminders: ReminderSync | { kind: "hidden" };
  reloadTasks: () => void;
  allowReminders: () => Promise<"unsupported" | "denied" | "granted">;
  addTask: (input: TaskInput) => Promise<Result<Board>>;
  toggleTask: (id: string) => Promise<Result<Board>>;
  setTaskPriority: (id: string, priority: boolean) => Promise<Result<Board>>;
  removeTask: (id: string) => Promise<Result<Board>>;
  moveTask: (id: string, dateKey: string) => Promise<Result<Board>>;
  postponeTask: (id: string) => Promise<Result<Board>>;
  shiftTaskMinutes: (id: string, minutes: number, now: { hour: number; minute: number }) => Promise<Result<Board>>;
  ignoreTask: (id: string) => Promise<Result<Board>>;
  setRecurrence: (id: string, recurrence: Recurrence) => Promise<Result<Board>>;
  addHabit: (title: string) => Result<Board>;
  toggleHabit: (id: string) => Result<Board>;
  removeHabit: (id: string) => Result<Board>;
  addGoal: (input: { title: string; domainId: GoalDomainId }) => Result<Board>;
  removeGoal: (id: string) => Result<Board>;
  setGivenName: (name: string) => Result<Board>;
  clearGivenName: () => void;
  setDraft: (draft: string) => void;
  clearDraft: () => void;
};

const BoardContext = createContext<BoardApi | null>(null);

function createId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `task-${Date.now().toString(36)}`;
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const userId = account.status.kind === "signed_in" ? account.status.profile.userId : null;
  const profile = account.status.kind === "signed_in" ? account.status.profile : null;
  const [board, setBoard] = useState<Board>(boardState.EMPTY_BOARD);
  const [trackedUser, setTrackedUser] = useState<string | null>(null);
  const [taskSync, setTaskSync] = useState<TaskSync>("session");
  const [reminders, setReminders] = useState<ReminderSync | { kind: "hidden" }>({ kind: "hidden" });
  const [reminderNonce, setReminderNonce] = useState(0);
  const [taskNonce, setTaskNonce] = useState(0);
  const boardRef = useRef(board);
  const taskSyncRef = useRef(taskSync);
  const sequence = useRef(0);

  if (userId !== trackedUser) {
    setTrackedUser(userId);
    if (!userId) {
      setTaskSync("session");
      if (trackedUser) {
        setBoard((current) => ({ ...current, tasks: [] }));
      }
    } else {
      setTaskSync("loading");
    }
  }

  useEffect(() => {
    boardRef.current = board;
    taskSyncRef.current = taskSync;
  }, [board, taskSync]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    const opened = getSupabase();
    if (!opened.ok) {
      return;
    }
    const keepCurrent = taskSyncRef.current === "account";
    void loadTasks(supabaseTaskStore(opened.value), userId).then((result) => {
      if (!active) {
        return;
      }
      if (!result.ok) {
        if (!keepCurrent) {
          setTaskSync("unavailable");
          setBoard((current) => ({ ...current, tasks: [] }));
        }
        return;
      }
      setBoard((current) => ({ ...current, tasks: result.value }));
      setTaskSync("account");
    });
    return () => {
      active = false;
    };
  }, [userId, taskNonce]);

  useEffect(() => {
    if (taskSync !== "account" || !profile) {
      return;
    }
    const plan = planReminders({
      tasks: board.tasks,
      now: new Date(),
      timeZone: profile.timeZone,
      dayStart: profile.dayStart,
      profile: profile.notificationProfile,
    });
    let active = true;
    void (async () => {
      if (Platform.OS === "web") {
        if (!userId) {
          return;
        }
        const inspected = await inspectWebReminders(userId);
        if (!active) {
          return;
        }
        if (inspected.kind !== "web-subscribed") {
          setReminders(inspected);
          return;
        }
        const opened = getSupabase();
        if (!opened.ok) {
          setReminders({ kind: "web-failed" });
          return;
        }
        const saved = await savePushPlan(opened.value, userId, plan);
        if (!active) {
          return;
        }
        setReminders(saved.ok ? { kind: "web-ready", count: saved.value } : { kind: "web-failed" });
        return;
      }
      const result = await syncReminders(plan);
      if (active) {
        setReminders(result);
      }
    })();
    return () => {
      active = false;
    };
  }, [taskSync, board.tasks, profile, reminderNonce, userId]);

  const commit = (result: Result<Board>) => {
    if (result.ok) {
      setBoard(result.value);
    }
    return result;
  };

  async function mutate(change: (current: Board) => Result<Board>): Promise<Result<Board>> {
    const current = boardRef.current;
    const next = change(current);
    if (!next.ok) {
      return next;
    }
    if (taskSyncRef.current === "session") {
      setBoard(next.value);
      return next;
    }
    if (taskSyncRef.current !== "account" || !userId) {
      return err("Les tâches ne sont pas disponibles.");
    }
    const opened = getSupabase();
    if (!opened.ok) {
      return err("Les tâches ne sont pas disponibles.");
    }
    const store = supabaseTaskStore(opened.value);
    const previousIds = new Set(current.tasks.map((task) => task.id));
    const nextIds = new Set(next.value.tasks.map((task) => task.id));
    const inserted = next.value.tasks.find((task) => !previousIds.has(task.id));
    const removed = current.tasks.find((task) => !nextIds.has(task.id));
    const updated = next.value.tasks.find((task) => {
      const before = current.tasks.find((item) => item.id === task.id);
      return before !== undefined && JSON.stringify(before) !== JSON.stringify(task);
    });
    if (inserted) {
      const saved = await saveNewTask(store, userId, inserted);
      if (!saved.ok) {
        return saved;
      }
      const tasks = next.value.tasks.map((task) => (task.id === saved.value.id ? saved.value : task));
      const merged = { ...next.value, tasks };
      setBoard(merged);
      return { ok: true, value: merged };
    }
    if (removed) {
      const saved = await deleteTask(store, userId, removed.id);
      if (!saved.ok) {
        return saved;
      }
      setBoard(next.value);
      return next;
    }
    if (updated) {
      const saved = await saveTask(store, userId, updated);
      if (!saved.ok) {
        return saved;
      }
      const tasks = next.value.tasks.map((task) => (task.id === saved.value.id ? saved.value : task));
      const merged = { ...next.value, tasks };
      setBoard(merged);
      return { ok: true, value: merged };
    }
    setBoard(next.value);
    return next;
  }

  const api: BoardApi = {
    board,
    taskSync,
    reminders: taskSync === "account" ? reminders : { kind: "hidden" },
    reloadTasks: () => {
      if (userId) {
        setTaskNonce((value) => value + 1);
      }
    },
    allowReminders: async () => {
      if (Platform.OS === "web") {
        if (!userId || !profile) {
          return "unsupported";
        }
        const enabled = await enableWebReminders(userId);
        if (!enabled.ok) {
          setReminders(enabled.reminders);
          return enabled.reminders.kind === "web-denied" ? "denied" : "unsupported";
        }
        const opened = getSupabase();
        if (!opened.ok) {
          setReminders({ kind: "web-failed" });
          return "unsupported";
        }
        const plan = planReminders({
          tasks: boardRef.current.tasks,
          now: new Date(),
          timeZone: profile.timeZone,
          dayStart: profile.dayStart,
          profile: profile.notificationProfile,
        });
        const saved = await savePushPlan(opened.value, userId, plan);
        setReminders(saved.ok ? { kind: "web-ready", count: saved.value } : { kind: "web-failed" });
        return saved.ok ? "granted" : "unsupported";
      }
      const result = await requestReminderAccess();
      if (result === "granted") {
        setReminderNonce((value) => value + 1);
      }
      return result;
    },
    addTask: (input) => mutate((current) => boardState.addTask(current, { ...input, id: createId() })),
    toggleTask: (id) => mutate((current) => boardState.toggleTask(current, id)),
    setTaskPriority: (id, priority) => mutate((current) => boardState.setTaskPriority(current, id, priority)),
    removeTask: (id) => mutate((current) => boardState.removeTask(current, id)),
    moveTask: (id, dateKey) => mutate((current) => boardState.moveTask(current, id, dateKey)),
    postponeTask: (id) => mutate((current) => boardState.postponeTask(current, id)),
    shiftTaskMinutes: (id, minutes, now) => mutate((current) => boardState.shiftTaskMinutes(current, id, minutes, now)),
    ignoreTask: (id) => mutate((current) => boardState.ignoreTask(current, id)),
    setRecurrence: (id, recurrence) => mutate((current) => boardState.setRecurrence(current, id, recurrence)),
    addHabit: (title) => {
      sequence.current += 1;
      return commit(boardState.addHabit(board, { id: `h${sequence.current}`, title }));
    },
    toggleHabit: (id) => commit(boardState.toggleHabit(board, id)),
    removeHabit: (id) => commit(boardState.removeHabit(board, id)),
    addGoal: (input) => {
      sequence.current += 1;
      return commit(boardState.addGoal(board, { ...input, id: `g${sequence.current}` }));
    },
    removeGoal: (id) => commit(boardState.removeGoal(board, id)),
    setGivenName: (name) => commit(boardState.setGivenName(board, name)),
    clearGivenName: () => setBoard(boardState.clearGivenName(board)),
    setDraft: (draft) => setBoard(boardState.writeDraft(board, draft)),
    clearDraft: () => setBoard(boardState.clearDraft(board)),
  };

  return <BoardContext.Provider value={api}>{children}</BoardContext.Provider>;
}

export function useBoard(): BoardApi {
  const value = useContext(BoardContext);
  if (!value) {
    throw new Error("Le tableau de session est absent.");
  }
  return value;
}

export type { BoardTask };
