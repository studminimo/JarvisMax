import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabase } from "@/data/supabase/client";
import {
  loadCoachBundle,
  removeGoal as removeRemoteGoal,
  removeHabit as removeRemoteHabit,
  saveCoachMode,
  saveDayNote,
  saveGoal,
  saveHabit,
  saveHabitDone,
  saveRoutine,
  saveStepDone,
  type CoachGoal,
  type CoachHabit,
} from "@/data/supabase/coach";
import { prepareGoal, prepareNote, prepareRoutine, type CoachMode, type Routine, type RoutineDraft } from "@/domain/coach";
import { type GoalDomainId } from "@/domain/goals";
import { ok, type Result } from "@/domain/result";
import { zonedDateKey } from "@/domain/time";

import { useAccount } from "../account/AccountProvider";

type CoachApi = {
  mode: CoachMode;
  ready: boolean;
  notice: string | null;
  routines: Routine[];
  goals: CoachGoal[];
  habits: CoachHabit[];
  note: string;
  reload: () => void;
  setMode: (mode: CoachMode) => Promise<string | null>;
  addRoutine: (draft: RoutineDraft) => Promise<string | null>;
  toggleStep: (stepId: string, doneOn: string | null) => Promise<string | null>;
  addGoal: (input: { title: string; domainId: GoalDomainId }) => Promise<Result<CoachGoal>>;
  deleteGoal: (id: string) => Promise<string | null>;
  addHabit: (title: string) => Promise<Result<CoachHabit>>;
  toggleHabit: (id: string, done: boolean, todayKey: string) => Promise<string | null>;
  deleteHabit: (id: string) => Promise<string | null>;
  saveNote: (content: string, todayKey: string) => Promise<string | null>;
};

const CoachContext = createContext<CoachApi | null>(null);

export function CoachProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const userId = account.status.kind === "signed_in" ? account.status.profile.userId : null;
  const [trackedUser, setTrackedUser] = useState<string | null>(userId);
  const [mode, setModeState] = useState<CoachMode>("normal");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [goals, setGoals] = useState<CoachGoal[]>([]);
  const [habits, setHabits] = useState<CoachHabit[]>([]);
  const [note, setNote] = useState("");
  const [nonce, setNonce] = useState(0);

  if (userId !== trackedUser) {
    setTrackedUser(userId);
    setReady(false);
    setNotice(null);
    setRoutines([]);
    setGoals([]);
    setHabits([]);
    setNote("");
    if (!userId) {
      setModeState("normal");
    }
  }

  const zone = account.status.kind === "signed_in" ? account.status.profile.timeZone : "Europe/Paris";

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    const todayKey = zonedDateKey(new Date(), zone);
    void Promise.resolve().then(async () => {
      const opened = getSupabase();
      if (!active) {
        return;
      }
      if (!opened.ok) {
        setNotice("Le coach n’est pas disponible.");
        setReady(false);
        return;
      }
      const loaded = await loadCoachBundle(opened.value, userId, todayKey);
      if (!active) {
        return;
      }
      if (!loaded.ok) {
        setNotice(loaded.error);
        setReady(false);
        return;
      }
      setModeState(loaded.value.mode);
      setRoutines(loaded.value.routines);
      setGoals(loaded.value.goals);
      setHabits(loaded.value.habits);
      setNote(loaded.value.note);
      setNotice(null);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [nonce, userId, zone]);

  function openClient(): { client: SupabaseClient; userId: string } | string {
    if (!userId) {
      return "Connecte-toi pour enregistrer.";
    }
    const opened = getSupabase();
    if (!opened.ok) {
      return "Le coach n’est pas disponible.";
    }
    return { client: opened.value, userId };
  }

  const api: CoachApi = {
    mode,
    ready: Boolean(userId) && ready,
    notice,
    routines: userId && ready ? routines : [],
    goals: userId && ready ? goals : [],
    habits: userId && ready ? habits : [],
    note: userId && ready ? note : "",
    reload,
    setMode: async (next) => {
      if (!userId) {
        setModeState(next);
        return null;
      }
      const opened = openClient();
      if (typeof opened === "string") {
        return opened;
      }
      const result = await saveCoachMode(opened.client, opened.userId, next);
      if (!result.ok) {
        return result.error;
      }
      setModeState(result.value);
      return null;
    },
    addRoutine: async (draft) => {
      const prepared = prepareRoutine(draft);
      if (!prepared.ok) {
        return prepared.error;
      }
      const opened = openClient();
      if (typeof opened === "string") {
        return opened;
      }
      const result = await saveRoutine(opened.client, opened.userId, prepared.value);
      if (!result.ok) {
        return result.error;
      }
      setRoutines((current) => [...current, result.value]);
      setReady(true);
      return null;
    },
    toggleStep: async (stepId, doneOn) => {
      const opened = openClient();
      if (typeof opened === "string") {
        return opened;
      }
      const result = await saveStepDone(opened.client, opened.userId, stepId, doneOn);
      if (!result.ok) {
        return result.error;
      }
      setRoutines((current) =>
        current.map((routine) => ({
          ...routine,
          steps: routine.steps.map((step) => (step.id === stepId ? { ...step, doneOn } : step)),
        })),
      );
      return null;
    },
    addGoal: async ({ title, domainId }) => {
      const prepared = prepareGoal({ title, domain: domainId });
      if (!prepared.ok) {
        return prepared;
      }
      const id = globalThis.crypto?.randomUUID?.() ?? "";
      if (!id) {
        return { ok: false, error: "Le serveur n’a pas répondu." };
      }
      const goal = { id, title: prepared.value.title, domainId: prepared.value.domain };
      const opened = openClient();
      if (typeof opened === "string") {
        return { ok: false, error: opened };
      }
      const result = await saveGoal(opened.client, opened.userId, goal);
      if (!result.ok) {
        return result;
      }
      setGoals((current) => [...current, result.value]);
      setReady(true);
      return ok(result.value);
    },
    deleteGoal: async (id) => {
      const opened = openClient();
      if (typeof opened === "string") {
        return opened;
      }
      const result = await removeRemoteGoal(opened.client, opened.userId, id);
      if (!result.ok) {
        return result.error;
      }
      setGoals((current) => current.filter((goal) => goal.id !== id));
      return null;
    },
    addHabit: async (title) => {
      const clean = title.trim();
      if (clean.length < 1 || clean.length > 80) {
        return { ok: false, error: "Quel est le titre ?" };
      }
      const id = globalThis.crypto?.randomUUID?.() ?? "";
      if (!id) {
        return { ok: false, error: "Le serveur n’a pas répondu." };
      }
      const opened = openClient();
      if (typeof opened === "string") {
        return { ok: false, error: opened };
      }
      const result = await saveHabit(opened.client, opened.userId, { id, title: clean, done: false });
      if (!result.ok) {
        return result;
      }
      setHabits((current) => [...current, result.value]);
      setReady(true);
      return ok(result.value);
    },
    toggleHabit: async (id, done, todayKey) => {
      const opened = openClient();
      if (typeof opened === "string") {
        return opened;
      }
      const result = await saveHabitDone(opened.client, opened.userId, id, todayKey, done);
      if (!result.ok) {
        return result.error;
      }
      setHabits((current) => current.map((habit) => (habit.id === id ? { ...habit, done } : habit)));
      return null;
    },
    deleteHabit: async (id) => {
      const opened = openClient();
      if (typeof opened === "string") {
        return opened;
      }
      const result = await removeRemoteHabit(opened.client, opened.userId, id);
      if (!result.ok) {
        return result.error;
      }
      setHabits((current) => current.filter((habit) => habit.id !== id));
      return null;
    },
    saveNote: async (content, todayKey) => {
      const prepared = prepareNote(content);
      if (!prepared.ok) {
        return prepared.error;
      }
      const opened = openClient();
      if (typeof opened === "string") {
        return opened;
      }
      const result = await saveDayNote(opened.client, opened.userId, todayKey, prepared.value);
      if (!result.ok) {
        return result.error;
      }
      setNote(result.value);
      return null;
    },
  };

  return <CoachContext.Provider value={api}>{children}</CoachContext.Provider>;
}

export function useCoach(): CoachApi {
  const value = useContext(CoachContext);
  if (!value) {
    throw new Error("Le coach est absent.");
  }
  return value;
}
