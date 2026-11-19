import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { logger } from "@/data/logger";
import { getSupabase } from "@/data/supabase/client";
import { loadAccountProfile, saveAccountProfile, supabaseProfileStore } from "@/data/supabase/profile";
import {
  authCodeToFailure,
  parseEmail,
  parsePassword,
  type AccountFailure,
  type AccountProfile,
} from "@/domain/account";
import { type NotificationProfile } from "@/domain/reminders";
import { err, ok, type Result } from "@/domain/result";

type AuthSession = {
  user: { id: string; email?: string | null };
};

export type AccountStatus =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "signed_out" }
  | { kind: "profile_unavailable"; email: string }
  | { kind: "signed_in"; email: string; profile: AccountProfile };

type AccountApi = {
  status: AccountStatus;
  signUp: (email: string, password: string) => Promise<Result<"session" | "confirmation", AccountFailure>>;
  signIn: (email: string, password: string) => Promise<Result<void, AccountFailure>>;
  signOut: () => Promise<Result<void, AccountFailure>>;
  saveGivenName: (givenName: string) => Promise<Result<AccountProfile, AccountFailure>>;
  saveTimeZone: (timeZone: string) => Promise<Result<AccountProfile, AccountFailure>>;
  saveNotificationProfile: (profile: NotificationProfile) => Promise<Result<AccountProfile, AccountFailure>>;
};

const AccountContext = createContext<AccountApi | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>(() =>
    getSupabase().ok ? { kind: "loading" } : { kind: "unconfigured" },
  );
  const statusRef = useRef(status);
  const ticket = useRef(0);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const applySession = useCallback(async (session: AuthSession | null) => {
    const current = ++ticket.current;
    const opened = getSupabase();
    if (current !== ticket.current) {
      return;
    }
    if (!opened.ok) {
      setStatus({ kind: "unconfigured" });
      return;
    }
    if (!session?.user.id) {
      setStatus({ kind: "signed_out" });
      return;
    }
    const profile = await loadAccountProfile(supabaseProfileStore(opened.value), session.user.id);
    if (current !== ticket.current) {
      return;
    }
    const email = session.user.email ?? "";
    if (!profile.ok) {
      logger.error(`profil ${profile.error}`);
      setStatus({ kind: "profile_unavailable", email });
      return;
    }
    setStatus({ kind: "signed_in", email, profile: profile.value });
  }, []);

  useEffect(() => {
    const opened = getSupabase();
    if (!opened.ok) {
      return;
    }
    const supabase = opened.value;
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }
      if (error) {
        logger.error("session rejected");
        void applySession(null);
        return;
      }
      void applySession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        void applySession(session);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [applySession]);

  const signUp = useCallback(async (emailRaw: string, passwordRaw: string) => {
    const email = parseEmail(emailRaw);
    if (!email.ok) {
      return email;
    }
    const password = parsePassword(passwordRaw);
    if (!password.ok) {
      return password;
    }
    const opened = getSupabase();
    if (!opened.ok) {
      return err("unavailable" as const);
    }
    try {
      const { data, error } = await opened.value.auth.signUp({
        email: email.value,
        password: password.value,
      });
      if (error) {
        const failure = authCodeToFailure(error.code);
        logger.error(`auth ${failure}`);
        return err(failure);
      }
      const outcome: "session" | "confirmation" = data.session ? "session" : "confirmation";
      return ok(outcome);
    } catch {
      return err("unavailable" as const);
    }
  }, []);

  const signIn = useCallback(async (emailRaw: string, passwordRaw: string) => {
    const email = parseEmail(emailRaw);
    if (!email.ok) {
      return email;
    }
    const password = parsePassword(passwordRaw);
    if (!password.ok) {
      return password;
    }
    const opened = getSupabase();
    if (!opened.ok) {
      return err("unavailable" as const);
    }
    try {
      const { error } = await opened.value.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      });
      if (error) {
        const failure = authCodeToFailure(error.code);
        logger.error(`auth ${failure}`);
        return err(failure);
      }
      return ok(undefined);
    } catch {
      return err("unavailable" as const);
    }
  }, []);

  const signOut = useCallback(async () => {
    const opened = getSupabase();
    if (!opened.ok) {
      return err("unavailable" as const);
    }
    try {
      const { error } = await opened.value.auth.signOut();
      if (error) {
        logger.error("auth rejected");
        return err("rejected" as const);
      }
      return ok(undefined);
    } catch {
      return err("unavailable" as const);
    }
  }, []);

  const saveField = useCallback(async (patch: {
    givenName?: string;
    timeZone?: string;
    notificationProfile?: NotificationProfile;
  }) => {
    const current = statusRef.current;
    if (current.kind !== "signed_in") {
      return err("unavailable" as const);
    }
    const opened = getSupabase();
    if (!opened.ok) {
      return err("unavailable" as const);
    }
    const saved = await saveAccountProfile(supabaseProfileStore(opened.value), current.profile.userId, patch);
    if (saved.ok) {
      const latest = statusRef.current;
      if (latest.kind === "signed_in" && latest.profile.userId === saved.value.userId) {
        setStatus({ kind: "signed_in", email: latest.email, profile: saved.value });
      }
    }
    return saved;
  }, []);

  const saveGivenName = useCallback(
    async (givenName: string) => {
      return saveField({ givenName });
    },
    [saveField],
  );

  const saveTimeZone = useCallback(
    async (timeZone: string) => {
      return saveField({ timeZone });
    },
    [saveField],
  );

  const saveNotificationProfile = useCallback(
    async (profile: NotificationProfile) => {
      return saveField({ notificationProfile: profile });
    },
    [saveField],
  );

  return (
    <AccountContext.Provider
      value={{ status, signUp, signIn, signOut, saveGivenName, saveTimeZone, saveNotificationProfile }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountApi {
  const account = useContext(AccountContext);
  if (!account) {
    throw new Error("Le compte n’est pas disponible");
  }
  return account;
}
