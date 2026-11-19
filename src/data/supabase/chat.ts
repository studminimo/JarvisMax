import type { SupabaseClient } from "@supabase/supabase-js";

import { err, ok, type Result } from "@/domain/result";

export type ChatLine = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ChatReply = {
  reply: string;
  tasksChanged: boolean;
  coachChanged: boolean;
  historySaved: boolean;
};

const FAILURE = "Jarvis n’a pas répondu.";

export function parseChatReply(data: unknown): ChatReply | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const row = data as Record<string, unknown>;
  if (typeof row.reply !== "string" || row.reply.trim().length === 0) {
    return null;
  }
  return {
    reply: row.reply.trim(),
    tasksChanged: row.tasksChanged === true,
    coachChanged: row.coachChanged === true,
    historySaved: row.historySaved === true,
  };
}

export function parseChatLines(data: unknown): ChatLine[] | null {
  if (!Array.isArray(data)) {
    return null;
  }
  const lines: ChatLine[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || (row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string" || row.content.length === 0) {
      return null;
    }
    lines.push({ id: row.id, role: row.role, content: row.content });
  }
  return lines;
}

export async function loadChatLines(client: SupabaseClient): Promise<Result<ChatLine[]>> {
  const { data, error } = await client.from("messages").select("id, role, content").order("created_at", { ascending: true }).limit(40);
  const lines = error ? null : parseChatLines(data);
  if (!lines) {
    return err("Les messages enregistrés ne sont pas disponibles.");
  }
  return ok(lines);
}

export async function sendToJarvis(
  client: SupabaseClient,
  input: { message: string; todayKey: string; timeZone: string },
): Promise<Result<ChatReply>> {
  const { data, error } = await client.functions.invoke("chat", { body: input });
  const reply = error ? null : parseChatReply(data);
  if (!reply) {
    return err(FAILURE);
  }
  return ok(reply);
}
