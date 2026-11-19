import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { TextButton } from "@/components/TextButton";
import { useTodayKey } from "@/components/useTodayKey";
import { getSupabase } from "@/data/supabase/client";
import { loadChatLines, sendToJarvis, type ChatLine } from "@/data/supabase/chat";
import { DRAFT_LIMIT } from "@/domain/board";
import { spacing } from "@/theme";

import { useAccount } from "../account/AccountProvider";
import { useActiveIdentity } from "../account/useActiveIdentity";
import { useBoard } from "../board/BoardProvider";
import { useCoach } from "../coach/CoachProvider";
import { speakText, startDictation } from "../voice/speech";

const SUGGESTIONS = [
  "Que reste-t-il aujourd’hui ?",
  "Quelles sont mes priorités ?",
  "Aide-moi à préparer demain.",
] as const;

export function JarvisScreen() {
  const account = useAccount();
  const { board, setDraft, clearDraft, reloadTasks } = useBoard();
  const coach = useCoach();
  const { timeZone } = useActiveIdentity();
  const todayKey = useTodayKey(timeZone);
  const userId = account.status.kind === "signed_in" ? account.status.profile.userId : null;
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [trackedUser, setTrackedUser] = useState<string | null>(userId);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const sending = useRef(false);
  const alive = useRef(true);

  if (userId !== trackedUser) {
    setTrackedUser(userId);
    setLines([]);
    setHistoryNote(null);
    setNotice(null);
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    const opened = getSupabase();
    if (!opened.ok) {
      return;
    }
    void loadChatLines(opened.value).then((result) => {
      if (!active) {
        return;
      }
      if (!result.ok) {
        setHistoryNote("Les messages enregistrés ne sont pas disponibles.");
        return;
      }
      setLines(result.value);
      setHistoryNote(null);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  async function send() {
    const message = board.draft.trim();
    if (!userId || !message || sending.current) {
      return;
    }
    const opened = getSupabase();
    if (!opened.ok) {
      setNotice("Jarvis n’a pas répondu.");
      return;
    }
    sending.current = true;
    setPending(true);
    setNotice(null);
    const result = await sendToJarvis(opened.value, { message, todayKey, timeZone });
    sending.current = false;
    if (!alive.current) {
      return;
    }
    setPending(false);
    if (!result.ok) {
      setNotice("Jarvis n’a pas répondu.");
      return;
    }
    clearDraft();
    if (result.value.tasksChanged) {
      reloadTasks();
    }
    if (result.value.coachChanged) {
      coach.reload();
    }
    const reply = result.value.reply;
    const stamp = Date.now().toString(36);
    const appended = (current: ChatLine[]): ChatLine[] => [
      ...current,
      { id: `local-user-${stamp}`, role: "user", content: message },
      { id: `local-jarvis-${stamp}`, role: "assistant", content: reply },
    ];
    if (result.value.historySaved) {
      const listed = await loadChatLines(opened.value);
      if (!alive.current) {
        return;
      }
      if (listed.ok) {
        setLines(listed.value);
        setHistoryNote(null);
        return;
      }
      setLines(appended);
      setHistoryNote("La réponse est affichée. L’historique n’a pas pu être relu.");
      return;
    }
    setLines(appended);
    setHistoryNote("La réponse est affichée. L’échange n’a pas été enregistré.");
  }

  const statusCopy =
    account.status.kind === "unconfigured"
      ? "La configuration publique est absente."
      : account.status.kind === "loading"
        ? "Chargement du compte."
        : userId
          ? null
          : "Connecte-toi pour envoyer un message.";
  const canSend = Boolean(userId) && board.draft.trim().length > 0 && !pending;

  return (
    <Screen>
      <AppText variant="overline">Conversation</AppText>
      <AppText accessibilityRole="header" variant="title">
        Jarvis
      </AppText>
      {statusCopy ? (
        <Card title="Compte">
          <AppText variant="muted">{statusCopy}</AppText>
        </Card>
      ) : null}
      {userId && lines.length === 0 && !historyNote ? (
        <Card title="Messages">
          <AppText variant="muted">Aucun message.</AppText>
        </Card>
      ) : null}
      {lines.map((line) => (
        <Card key={line.id} title={line.role === "user" ? "Toi" : "Jarvis"}>
          <AppText>{line.content}</AppText>
        </Card>
      ))}
      {historyNote ? <AppText variant="muted">{historyNote}</AppText> : null}
      {notice ? <AppText variant="muted">{notice}</AppText> : null}
      <Card title="Message">
        <Field
          label="Message"
          maxLength={DRAFT_LIMIT}
          multiline
          onChangeText={setDraft}
          placeholder="Écrire un message"
          value={board.draft}
        />
        <AppText variant="label">
          {board.draft.length}/{DRAFT_LIMIT}
        </AppText>
        <View style={styles.suggestions}>
          {SUGGESTIONS.filter((suggestion) => suggestion !== board.draft).map((suggestion) => (
            <TextButton key={suggestion} label={suggestion} onPress={() => setDraft(suggestion)} />
          ))}
        </View>
        {pending ? <AppText variant="muted">Envoi.</AppText> : null}
        {canSend ? <PrimaryButton label="Envoyer" onPress={() => void send()} /> : null}
        <TextButton
          label="Dicter"
          onPress={() => {
            const session = startDictation((text) => setDraft(text.slice(0, DRAFT_LIMIT)));
            if (!session) {
              setNotice("La dictée n’est pas disponible ici.");
            }
          }}
        />
        <TextButton
          label="Lire"
          onPress={() => {
            const last = [...lines].reverse().find((line) => line.role === "assistant");
            if (!last) {
              setNotice("Aucune réponse à lire.");
              return;
            }
            if (!speakText(last.content)) {
              setNotice("La lecture n’est pas disponible ici.");
            }
          }}
        />
        {board.draft.length > 0 && !pending ? <TextButton label="Effacer" onPress={clearDraft} /> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  suggestions: {
    gap: spacing.xs,
  },
});
