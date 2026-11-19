import Constants from "expo-constants";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { TextButton } from "@/components/TextButton";
import { NAME_LIMIT } from "@/domain/board";
import {
  EMAIL_MAX,
  PASSWORD_MAX,
  accountErrorMessage,
  parseEmail,
  parsePassword,
  timeZoneChoices,
  type AccountFailure,
} from "@/domain/account";
import { NOTIFICATION_PROFILES, type NotificationProfile } from "@/domain/reminders";
import { type Result } from "@/domain/result";
import { PRODUCT_TIME_ZONE } from "@/domain/time";
import { colors, spacing } from "@/theme";

import { MemorySection } from "../memory/MemorySection";
import { useAccount, type AccountStatus } from "../account/AccountProvider";
import { useBoard } from "../board/BoardProvider";
import { type ReminderSync } from "../reminders/device";

type SaveResult = string | null | Promise<string | null>;

const PROFILE_LABELS: Record<NotificationProfile, string> = {
  normal: "Normal",
  intensive: "Intensif",
  focus: "Concentration",
  rest: "Repos",
  custom: "Personnalisé",
};

function reminderCopy(reminders: ReminderSync | { kind: "hidden" }): string {
  if (reminders.kind === "hidden") {
    return "Préparation des rappels.";
  }
  if (reminders.kind === "web-install") {
    return "Dans Safari : Partager, puis Sur l’écran d’accueil. Ouvre JARVIS depuis l’icône, puis autorise les rappels.";
  }
  if (reminders.kind === "web-unconfigured") {
    return "Les rappels du site ne sont pas encore configurés.";
  }
  if (reminders.kind === "web-unsupported") {
    return "Ce navigateur ne reçoit pas les rappels.";
  }
  if (reminders.kind === "web-denied" || reminders.kind === "denied") {
    return "Les rappels ne sont pas autorisés.";
  }
  if (reminders.kind === "web-prompt" || reminders.kind === "web-subscribed") {
    return "Autorise les rappels pour les recevoir à l’heure de la tâche.";
  }
  if (reminders.kind === "web-failed") {
    return "Les rappels n’ont pas pu être préparés.";
  }
  if (reminders.kind === "web-ready") {
    if (reminders.count === 0) {
      return "Aucun rappel dans les 48 prochaines heures.";
    }
    if (reminders.count === 1) {
      return "1 rappel est préparé pour les 48 prochaines heures.";
    }
    return `${reminders.count} rappels sont préparés pour les 48 prochaines heures.`;
  }
  if (reminders.kind === "unsupported") {
    return "Les rappels se programment sur l’iPhone.";
  }
  if (reminders.kind === "failed") {
    return "Les rappels n’ont pas pu être programmés.";
  }
  if (reminders.count === 0) {
    return "Aucun rappel dans les 48 prochaines heures.";
  }
  if (reminders.count === 1) {
    return "1 rappel programmé.";
  }
  return `${reminders.count} rappels programmés.`;
}

export function ProfileScreen() {
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const { board, setGivenName, clearGivenName, reminders, allowReminders } = useBoard();
  const { status, signIn, signUp, signOut, saveGivenName, saveTimeZone, saveNotificationProfile } = useAccount();
  const [nameOpen, setNameOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profilePending, setProfilePending] = useState(false);
  const signedIn = status.kind === "signed_in";

  async function disconnect() {
    setIdentityError(null);
    const result = await signOut();
    if (!result.ok) {
      setIdentityError(accountErrorMessage(result.error));
    }
  }

  return (
    <>
      <Screen>
        <AppText variant="overline">Compte</AppText>
        <AppText accessibilityRole="header" variant="title">
          Profil
        </AppText>
        <Card title="Identité">
          <Identity
            identityError={identityError}
            notice={notice}
            onSignIn={signIn}
            onSignOut={() => {
              void disconnect();
            }}
            onSignUp={async (email, password) => {
              const result = await signUp(email, password);
              if (result.ok && result.value === "confirmation") {
                setNotice(
                  "Le compte est demandé. Si l’adresse doit être confirmée, ouvre le message reçu avant de te connecter.",
                );
              }
              return result;
            }}
            status={status}
          />
        </Card>
        {signedIn ? (
          <Card delay={40} title="Salutation">
            <AppText variant={status.profile.givenName ? "body" : "muted"}>
              {status.profile.givenName || "Aucun prénom indiqué."}
            </AppText>
            <AppText variant="muted">Enregistré sur le compte.</AppText>
            <View style={styles.actions}>
              <TextButton
                label={status.profile.givenName ? "Modifier" : "Indiquer un prénom"}
                onPress={() => setNameOpen(true)}
              />
              {status.profile.givenName ? (
                <TextButton
                  label="Retirer"
                  onPress={() => {
                    void saveGivenName("").then((result) => {
                      if (!result.ok) {
                        setIdentityError(accountErrorMessage(result.error));
                      }
                    });
                  }}
                />
              ) : null}
            </View>
          </Card>
        ) : (
          <Card delay={40} title="Salutation">
            <AppText variant={board.givenName ? "body" : "muted"}>
              {board.givenName || "Aucun prénom indiqué."}
            </AppText>
            <AppText variant="muted">Il apparaît à l’accueil, le temps de cette ouverture.</AppText>
            <View style={styles.actions}>
              <TextButton label={board.givenName ? "Modifier" : "Indiquer un prénom"} onPress={() => setNameOpen(true)} />
              {board.givenName ? <TextButton label="Retirer" onPress={clearGivenName} /> : null}
            </View>
          </Card>
        )}
        <Card delay={80} title="Affichage">
          <AppText variant="body">{signedIn ? status.profile.timeZone : PRODUCT_TIME_ZONE}</AppText>
          <AppText variant="muted">
            {signedIn
              ? "Fuseau utilisé pour l’horloge et le calendrier."
              : "Fuseau utilisé pour l’horloge et le calendrier. Il sera enregistré avec le compte."}
          </AppText>
          {signedIn ? (
            <View style={styles.actions}>
              <TextButton label="Changer" onPress={() => setZoneOpen(true)} />
            </View>
          ) : null}
        </Card>
        {signedIn ? (
          <Card delay={100} title="Rappels">
            <AppText variant="body">{PROFILE_LABELS[status.profile.notificationProfile]}</AppText>
            <AppText variant="muted">{reminderCopy(reminders)}</AppText>
            {profileError ? (
              <AppText style={styles.error} variant="muted">
                {profileError}
              </AppText>
            ) : null}
            {profilePending ? <AppText variant="muted">Enregistrement.</AppText> : null}
            {!profilePending ? (
              <View style={styles.form}>
                {NOTIFICATION_PROFILES.filter((profile) => profile !== status.profile.notificationProfile).map(
                  (profile) => (
                    <TextButton
                      key={profile}
                      label={PROFILE_LABELS[profile]}
                      onPress={() => {
                        setProfilePending(true);
                        setProfileError(null);
                        void saveNotificationProfile(profile).then((result) => {
                          setProfilePending(false);
                          if (!result.ok) {
                            setProfileError(accountErrorMessage(result.error));
                          }
                        });
                      }}
                    />
                  ),
                )}
                {reminders.kind === "denied" || reminders.kind === "web-prompt" || reminders.kind === "web-denied" || reminders.kind === "web-failed" ? (
                  <TextButton
                    label="Autoriser les rappels"
                    onPress={() => {
                      void allowReminders();
                    }}
                  />
                ) : null}
              </View>
            ) : null}
          </Card>
        ) : null}
        {signedIn ? (
          <MemorySection userId={status.profile.userId} />
        ) : status.kind === "signed_out" || status.kind === "profile_unavailable" ? (
          <MemorySection userId={null} />
        ) : null}
        <Card delay={120} title="Branchements">
          <AppText variant="body">Le minuteur est sur l’accueil.</AppText>
          <AppText variant="body">Dicter et Lire sont dans Jarvis, si l’appareil le permet.</AppText>
          <AppText variant="muted">Calendrier, widgets, raccourcis et lieu : pas encore branchés.</AppText>
        </Card>
        <Card delay={160} title="Application">
          <AppText variant="body">Version {version}</AppText>
        </Card>
      </Screen>
      <Sheet onClose={() => setNameOpen(false)} title="Prénom" visible={nameOpen}>
        {nameOpen && signedIn ? (
          <NameForm
            initial={status.profile.givenName}
            onClear={async () => {
              const result = await saveGivenName("");
              if (result.ok) {
                setNameOpen(false);
              }
              return result.ok ? null : accountErrorMessage(result.error);
            }}
            onSave={async (name) => {
              const result = await saveGivenName(name);
              if (result.ok) {
                setNameOpen(false);
              }
              return result.ok ? null : accountErrorMessage(result.error);
            }}
          />
        ) : null}
        {nameOpen && !signedIn ? (
          <NameForm
            initial={board.givenName}
            onClear={() => {
              clearGivenName();
              setNameOpen(false);
              return null;
            }}
            onSave={(name) => {
              const result = setGivenName(name);
              if (result.ok) {
                setNameOpen(false);
              }
              return result.ok ? null : result.error;
            }}
          />
        ) : null}
      </Sheet>
      <Sheet onClose={() => setZoneOpen(false)} title="Fuseau" visible={zoneOpen}>
        {zoneOpen && signedIn ? (
          <TimeZoneForm
            current={status.profile.timeZone}
            onSave={async (zone) => {
              const result = await saveTimeZone(zone);
              if (result.ok) {
                setZoneOpen(false);
              }
              return result.ok ? null : accountErrorMessage(result.error);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function Identity({
  status,
  notice,
  identityError,
  onSignIn,
  onSignUp,
  onSignOut,
}: {
  status: AccountStatus;
  notice: string | null;
  identityError: string | null;
  onSignIn: (email: string, password: string) => Promise<Result<void, AccountFailure>>;
  onSignUp: (
    email: string,
    password: string,
  ) => Promise<Result<"session" | "confirmation", AccountFailure>>;
  onSignOut: () => void;
}) {
  if (status.kind === "loading") {
    return <AppText variant="muted">Vérification de la session.</AppText>;
  }
  if (status.kind === "unconfigured") {
    return (
      <AppText variant="muted">
        La configuration publique est absente. Renseigne EXPO_PUBLIC_SUPABASE_URL et
        EXPO_PUBLIC_SUPABASE_ANON_KEY dans le fichier .env, puis relance l’application.
      </AppText>
    );
  }
  if (status.kind === "signed_out") {
    return <AuthForm notice={notice} onSignIn={onSignIn} onSignUp={onSignUp} />;
  }
  return (
    <View style={styles.form}>
      {status.email ? <AppText variant="body">{status.email}</AppText> : null}
      {status.kind === "profile_unavailable" ? (
        <AppText variant="muted">Le profil n’est pas disponible.</AppText>
      ) : null}
      {identityError ? (
        <AppText style={styles.error} variant="muted">
          {identityError}
        </AppText>
      ) : null}
      <TextButton label="Se déconnecter" onPress={onSignOut} />
    </View>
  );
}

function AuthForm({
  notice,
  onSignIn,
  onSignUp,
}: {
  notice: string | null;
  onSignIn: (email: string, password: string) => Promise<Result<void, AccountFailure>>;
  onSignUp: (
    email: string,
    password: string,
  ) => Promise<Result<"session" | "confirmation", AccountFailure>>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailOk = parseEmail(email).ok;
  const passwordResult = parsePassword(password);
  const ready = emailOk && passwordResult.ok && !pending;

  async function submit(mode: "in" | "up") {
    setPending(true);
    setError(null);
    const result = mode === "in" ? await onSignIn(email, password) : await onSignUp(email, password);
    if (!result.ok) {
      setPending(false);
      setError(accountErrorMessage(result.error));
      return;
    }
    if (result.value === "confirmation") {
      setPending(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        label="Adresse e-mail"
        maxLength={EMAIL_MAX}
        onChangeText={(value) => {
          setEmail(value);
          setError(null);
        }}
        placeholder="lea@exemple.fr"
        textContentType="emailAddress"
        value={email}
      />
      <Field
        autoComplete="password"
        label="Mot de passe"
        maxLength={PASSWORD_MAX}
        onChangeText={(value) => {
          setPassword(value);
          setError(null);
        }}
        placeholder="8 caractères minimum"
        secureTextEntry
        textContentType="password"
        value={password}
      />
      {email.trim().length > 0 && !emailOk ? (
        <AppText variant="muted">{accountErrorMessage("invalid_email")}</AppText>
      ) : null}
      {password.length > 0 && !passwordResult.ok && passwordResult.error === "password_too_short" ? (
        <AppText variant="muted">{accountErrorMessage("password_too_short")}</AppText>
      ) : null}
      {notice ? <AppText variant="muted">{notice}</AppText> : null}
      {error ? (
        <AppText style={styles.error} variant="muted">
          {error}
        </AppText>
      ) : null}
      {pending ? <AppText variant="muted">Demande en cours.</AppText> : null}
      {ready ? (
        <View style={styles.form}>
          <PrimaryButton label="Se connecter" onPress={() => void submit("in")} />
          <TextButton label="Créer un compte" onPress={() => void submit("up")} />
        </View>
      ) : null}
    </View>
  );
}

function NameForm({
  initial,
  onSave,
  onClear,
}: {
  initial: string;
  onSave: (name: string) => SaveResult;
  onClear: () => SaveResult;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const trimmed = name.trim().replace(/\s+/g, " ");
  const changed = trimmed !== initial.trim();

  function run(work: SaveResult) {
    setPending(true);
    setError(null);
    void Promise.resolve(work).then(
      (message) => {
        setPending(false);
        if (message) {
          setError(message);
        }
      },
      () => {
        setPending(false);
        setError(accountErrorMessage("unavailable"));
      },
    );
  }

  return (
    <View style={styles.form}>
      <Field
        autoCapitalize="words"
        autoComplete="name"
        label="Prénom"
        maxLength={NAME_LIMIT}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        placeholder="Léa"
        textContentType="name"
        value={name}
      />
      {error ? (
        <AppText style={styles.error} variant="muted">
          {error}
        </AppText>
      ) : null}
      {pending ? <AppText variant="muted">Enregistrement.</AppText> : null}
      {!pending && trimmed.length > 0 && changed ? <PrimaryButton label="Retenir" onPress={() => run(onSave(name))} /> : null}
      {!pending && trimmed.length === 0 && initial.trim().length > 0 ? (
        <TextButton label="Retirer" onPress={() => run(onClear())} />
      ) : null}
    </View>
  );
}

function TimeZoneForm({
  current,
  onSave,
}: {
  current: string;
  onSave: (zone: string) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const choices = timeZoneChoices(current).filter((zone) => zone !== current);

  return (
    <View style={styles.form}>
      <AppText variant="body">{current}</AppText>
      <AppText variant="muted">Fuseau actuel.</AppText>
      {error ? (
        <AppText style={styles.error} variant="muted">
          {error}
        </AppText>
      ) : null}
      {pending ? <AppText variant="muted">Enregistrement.</AppText> : null}
      {!pending
        ? choices.map((zone) => (
            <TextButton
              key={zone}
              label={zone}
              onPress={() => {
                setPending(true);
                setError(null);
                void onSave(zone).then(
                  (message) => {
                    setPending(false);
                    if (message) {
                      setError(message);
                    }
                  },
                  () => {
                    setPending(false);
                    setError(accountErrorMessage("unavailable"));
                  },
                );
              }}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  form: {
    gap: spacing.md,
  },
  error: {
    color: colors.accent,
  },
});
