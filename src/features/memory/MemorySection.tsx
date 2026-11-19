import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Sheet } from "@/components/Sheet";
import { TextButton } from "@/components/TextButton";
import { getSupabase } from "@/data/supabase/client";
import { deleteMemory, loadMemories, memoryFromWrite, saveMemory, saveNewMemory, supabaseMemoryStore } from "@/data/supabase/memories";
import {
  MEMORY_CATEGORIES,
  MEMORY_CONTENT_LIMIT,
  MEMORY_LABELS,
  isSensitiveCategory,
  prepareMemory,
  type Memory,
  type MemoryCategory,
} from "@/domain/memory";
import { colors, spacing } from "@/theme";

type Editor =
  | { mode: "create" }
  | { mode: "edit"; memory: Memory };

export function MemorySection({ userId }: { userId: string | null }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [trackedUser, setTrackedUser] = useState<string | null>(userId);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">(userId ? "loading" : "idle");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (userId !== trackedUser) {
    setTrackedUser(userId);
    setMemories([]);
    setStatus(userId ? "loading" : "idle");
    setEditor(null);
    setNotice(null);
  }

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        return;
      }
      let active = true;
      void Promise.resolve().then(async () => {
        const opened = getSupabase();
        if (!active) {
          return;
        }
        if (!opened.ok) {
          setStatus("unavailable");
          return;
        }
        const listed = await loadMemories(supabaseMemoryStore(opened.value), userId);
        if (!active) {
          return;
        }
        if (listed.ok) {
          setMemories(listed.value);
          setStatus("ready");
          setNotice(null);
          return;
        }
        setStatus("unavailable");
        setNotice(listed.error);
      });
      return () => {
        active = false;
      };
    }, [userId]),
  );

  async function create(draft: { content: string; category: MemoryCategory; agreed: boolean }) {
    if (!userId) {
      return "Les souvenirs ne sont pas disponibles.";
    }
    const prepared = prepareMemory({ ...draft, origin: "user" });
    if (!prepared.ok) {
      return prepared.error;
    }
    const opened = getSupabase();
    if (!opened.ok) {
      return "Les souvenirs ne sont pas disponibles.";
    }
    const id = globalThis.crypto?.randomUUID?.() ?? "";
    if (!id) {
      return "Le serveur n’a pas répondu.";
    }
    const saved = await saveNewMemory(supabaseMemoryStore(opened.value), userId, memoryFromWrite(id, prepared.value));
    if (!saved.ok) {
      return saved.error;
    }
    setMemories((current) => [saved.value, ...current.filter((item) => item.id !== saved.value.id)]);
    setStatus("ready");
    setEditor(null);
    return null;
  }

  async function update(memory: Memory, draft: { content: string; category: MemoryCategory; agreed: boolean }) {
    if (!userId) {
      return "Les souvenirs ne sont pas disponibles.";
    }
    const prepared = prepareMemory({ ...draft, origin: memory.origin });
    if (!prepared.ok) {
      return prepared.error;
    }
    const opened = getSupabase();
    if (!opened.ok) {
      return "Les souvenirs ne sont pas disponibles.";
    }
    const saved = await saveMemory(
      supabaseMemoryStore(opened.value),
      userId,
      memoryFromWrite(memory.id, prepared.value),
    );
    if (!saved.ok) {
      return saved.error;
    }
    setMemories((current) => current.map((item) => (item.id === saved.value.id ? saved.value : item)));
    setEditor(null);
    return null;
  }

  async function remove(memory: Memory) {
    if (!userId) {
      return;
    }
    const opened = getSupabase();
    if (!opened.ok) {
      setNotice("Les souvenirs ne sont pas disponibles.");
      return;
    }
    const removed = await deleteMemory(supabaseMemoryStore(opened.value), userId, memory.id);
    if (!removed.ok) {
      setNotice(removed.error);
      return;
    }
    setMemories((current) => current.filter((item) => item.id !== memory.id));
    setNotice(null);
    if (editor?.mode === "edit" && editor.memory.id === memory.id) {
      setEditor(null);
    }
  }

  return (
    <>
      <Card title="Mémoire">
        {!userId ? <AppText variant="muted">Connecte-toi pour consulter les souvenirs.</AppText> : null}
        {userId && status === "loading" ? <AppText variant="muted">Chargement des souvenirs.</AppText> : null}
        {userId && status === "unavailable" ? (
          <AppText variant="muted">{notice ?? "Les souvenirs ne sont pas disponibles."}</AppText>
        ) : null}
        {userId && status === "ready" && memories.length === 0 ? <AppText variant="muted">Aucun souvenir.</AppText> : null}
        {userId && status === "ready"
          ? memories.map((memory) => (
              <View key={memory.id} style={styles.item}>
                <AppText variant="body">{memory.content}</AppText>
                <AppText variant="muted">
                  {MEMORY_LABELS[memory.category]}
                  {memory.sensitive ? " · Sensible" : ""}
                  {memory.origin === "confirmed_suggestion" ? " · Proposé par Jarvis" : ""}
                </AppText>
                <View style={styles.actions}>
                  <TextButton label="Modifier" onPress={() => setEditor({ mode: "edit", memory })} />
                  <TextButton label="Supprimer" onPress={() => void remove(memory)} />
                </View>
              </View>
            ))
          : null}
        {notice && status === "ready" ? (
          <AppText style={styles.error} variant="muted">
            {notice}
          </AppText>
        ) : null}
        {userId && status === "ready" ? (
          <TextButton label="Ajouter un souvenir" onPress={() => setEditor({ mode: "create" })} />
        ) : null}
      </Card>
      <Sheet onClose={() => setEditor(null)} title={editor?.mode === "edit" ? "Modifier le souvenir" : "Nouveau souvenir"} visible={editor !== null}>
        {editor ? (
          <MemoryForm
            initial={editor.mode === "edit" ? editor.memory : null}
            onSave={(draft) => (editor.mode === "edit" ? update(editor.memory, draft) : create(draft))}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function MemoryForm({
  initial,
  onSave,
}: {
  initial: Memory | null;
  onSave: (draft: { content: string; category: MemoryCategory; agreed: boolean }) => Promise<string | null>;
}) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [category, setCategory] = useState<MemoryCategory>(initial?.category ?? "fact");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const sensitive = isSensitiveCategory(category);
  const prepared = prepareMemory({ content, category, agreed, origin: initial?.origin ?? "user" });
  const unchanged =
    initial !== null && content.trim() === initial.content && category === initial.category;

  return (
    <View style={styles.form}>
      <Field
        label="Souvenir"
        maxLength={MEMORY_CONTENT_LIMIT}
        multiline
        onChangeText={(value) => {
          setContent(value);
          setError(null);
        }}
        placeholder="Préfère le matin"
        value={content}
      />
      <AppText variant="body">{MEMORY_LABELS[category]}</AppText>
      <View style={styles.form}>
        {MEMORY_CATEGORIES.filter((item) => item !== category).map((item) => (
          <TextButton
            key={item}
            label={MEMORY_LABELS[item]}
            onPress={() => {
              setCategory(item);
              setAgreed(false);
              setError(null);
            }}
          />
        ))}
      </View>
      {error ? (
        <AppText style={styles.error} variant="muted">
          {error}
        </AppText>
      ) : null}
      {pending ? <AppText variant="muted">Enregistrement.</AppText> : null}
      {!pending && sensitive && !agreed && content.trim().length > 0 ? (
        <TextButton label="J’accepte d’enregistrer cette information sensible" onPress={() => setAgreed(true)} />
      ) : null}
      {!pending && prepared.ok && !unchanged ? (
        <PrimaryButton
          label="Enregistrer"
          onPress={() => {
            setPending(true);
            setError(null);
            void onSave({ content, category, agreed }).then((message) => {
              setPending(false);
              if (message) {
                setError(message);
              }
            });
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    gap: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  form: {
    gap: spacing.sm,
  },
  error: {
    color: colors.accent,
  },
});
