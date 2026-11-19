import {
  PROFILE_TIME_ZONES,
  accountErrorMessage,
  authCodeToFailure,
  isValidTimeZone,
  parseEmail,
  parseGivenName,
  parsePassword,
  parseTimeZone,
  profileFromRow,
  timeZoneChoices,
} from "./account";

describe("compte", () => {
  it("normalise une adresse et refuse les formes inutilisables", () => {
    expect(parseEmail("  Léa@Exemple.fr ")).toEqual({ ok: true, value: "léa@exemple.fr" });
    expect(parseEmail("pas-une-adresse")).toEqual({ ok: false, error: "invalid_email" });
    expect(parseEmail(`${"a".repeat(250)}@b.co`)).toEqual({ ok: false, error: "invalid_email" });
  });

  it("exige un mot de passe entre 8 et 72 caractères, sans le couper", () => {
    expect(parsePassword("secret12")).toEqual({ ok: true, value: "secret12" });
    expect(parsePassword("court")).toEqual({ ok: false, error: "password_too_short" });
    expect(parsePassword("x".repeat(73))).toEqual({ ok: false, error: "password_too_long" });
  });

  it("accepte un prénom vide et refuse un prénom trop long", () => {
    expect(parseGivenName("  Léa   Martin ")).toEqual({ ok: true, value: "Léa Martin" });
    expect(parseGivenName("   ")).toEqual({ ok: true, value: "" });
    expect(parseGivenName("a".repeat(41))).toEqual({ ok: false, error: "name_too_long" });
  });

  it("reconnaît les fuseaux proposés et un identifiant IANA réel", () => {
    for (const zone of PROFILE_TIME_ZONES) {
      expect(isValidTimeZone(zone)).toBe(true);
    }
    expect(parseTimeZone(" Pacific/Auckland ")).toEqual({ ok: true, value: "Pacific/Auckland" });
    expect(parseTimeZone("Europe/Nullepart")).toEqual({ ok: false, error: "invalid_time_zone" });
  });

  it("lit une ligne de profil et rejette une ligne incomplète", () => {
    expect(
      profileFromRow({
        user_id: "user-1",
        given_name: " Max ",
        time_zone: "Europe/Paris",
      }),
    ).toEqual({
      ok: true,
      value: {
        userId: "user-1",
        givenName: "Max",
        timeZone: "Europe/Paris",
        notificationProfile: "normal",
        dayStart: "07:00",
        dayEnd: "22:00",
      },
    });
    expect(profileFromRow({ user_id: "user-1", given_name: "Max", time_zone: "Fake/Zone" })).toEqual({
      ok: false,
      error: "invalid_profile",
    });
    expect(profileFromRow(null)).toEqual({ ok: false, error: "invalid_profile" });
  });

  it("traduit les codes d’auth connus et garde un repli sans détail technique", () => {
    expect(authCodeToFailure("email_exists")).toBe("email_taken");
    expect(authCodeToFailure("over_email_send_rate_limit")).toBe("rate_limited");
    expect(authCodeToFailure("weak_password")).toBe("password_rejected");
    expect(authCodeToFailure(undefined)).toBe("rejected");
    expect(accountErrorMessage("invalid_credentials")).toBe("Adresse ou mot de passe incorrect.");
    expect(accountErrorMessage("unavailable")).toBe("Le serveur n’a pas répondu.");
  });

  it("ajoute le fuseau déjà enregistré s’il est valide et hors liste", () => {
    expect(timeZoneChoices("Europe/Paris")[0]).toBe("Europe/Paris");
    expect(timeZoneChoices("Pacific/Auckland")[0]).toBe("Pacific/Auckland");
    expect(timeZoneChoices("Fake/Zone")).toEqual(PROFILE_TIME_ZONES);
  });
});
