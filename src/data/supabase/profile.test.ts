import { loadAccountProfile, saveAccountProfile, type ProfileRow, type ProfileStore } from "./profile";

function row(partial: Partial<ProfileRow> = {}): ProfileRow {
  return {
    user_id: "user-1",
    given_name: "",
    time_zone: "Europe/Paris",
    notification_profile: "normal",
    day_start: "07:00:00",
    day_end: "22:00:00",
    ...partial,
  };
}

function store(initial: ProfileRow | null, failUpdate = false): ProfileStore & { saved: ProfileRow | null } {
  const state = { saved: initial };
  return {
    get saved() {
      return state.saved;
    },
    async read() {
      return { row: state.saved, failed: false };
    },
    async insert(userId) {
      state.saved = row({ user_id: userId });
      return { row: state.saved, failed: false };
    },
    async update(_userId, patch) {
      if (failUpdate || !state.saved) {
        return { row: null, failed: true };
      }
      state.saved = { ...state.saved, ...patch };
      return { row: state.saved, failed: false };
    },
  };
}

describe("profil distant", () => {
  it("crée la ligne manquante puis la lit", async () => {
    const memory = store(null);
    const result = await loadAccountProfile(memory, "user-1");
    expect(result).toEqual({
      ok: true,
      value: {
        userId: "user-1",
        givenName: "",
        timeZone: "Europe/Paris",
        notificationProfile: "normal",
        dayStart: "07:00",
        dayEnd: "22:00",
      },
    });
  });

  it("ne confirme le prénom que si la ligne renvoyée le contient", async () => {
    const memory = store(row({ given_name: "Max" }));
    const saved = await saveAccountProfile(memory, "user-1", { givenName: "Léa" });
    expect(saved).toEqual({
      ok: true,
      value: {
        userId: "user-1",
        givenName: "Léa",
        timeZone: "Europe/Paris",
        notificationProfile: "normal",
        dayStart: "07:00",
        dayEnd: "22:00",
      },
    });

    const stale: ProfileStore = {
      async read() {
        return { row: row(), failed: false };
      },
      async insert() {
        return { row: null, failed: true };
      },
      async update() {
        return { row: row({ given_name: "Max" }), failed: false };
      },
    };
    expect(await saveAccountProfile(stale, "user-1", { givenName: "Léa" })).toEqual({
      ok: false,
      error: "unavailable",
    });
  });

  it("refuse un fuseau inconnu avant toute écriture", async () => {
    const memory = store(row());
    expect(await saveAccountProfile(memory, "user-1", { timeZone: "Fake/Zone" })).toEqual({
      ok: false,
      error: "invalid_time_zone",
    });
    expect(memory.saved?.time_zone).toBe("Europe/Paris");
  });
});
