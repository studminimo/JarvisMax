import type { SupabaseClient } from "@supabase/supabase-js";

import { loadChatLines, parseChatLines, parseChatReply, sendToJarvis } from "./chat";

describe("réponse de chat", () => {
  it("accepte une réponse et refuse un corps sans texte", () => {
    expect(parseChatReply({ reply: " C’est noté. ", tasksChanged: true, historySaved: false })).toEqual({
      reply: "C’est noté.",
      tasksChanged: true,
      coachChanged: false,
      historySaved: false,
    });
    expect(parseChatReply({ reply: "   ", tasksChanged: true })).toBeNull();
    expect(parseChatReply({ error: "unavailable" })).toBeNull();
  });

  it("refuse un historique illisible", () => {
    expect(parseChatLines([{ id: "1", role: "assistant", content: "Bonjour" }])).toEqual([{ id: "1", role: "assistant", content: "Bonjour" }]);
    expect(parseChatLines([{ id: "1", role: "system", content: "secret" }])).toBeNull();
  });

  it("dit que Jarvis n’a pas répondu quand la fonction échoue", async () => {
    const failed = {
      functions: { invoke: async () => ({ data: null, error: { message: "relay" } }) },
    } as unknown as SupabaseClient;
    await expect(sendToJarvis(failed, { message: "Bonjour", todayKey: "2026-11-19", timeZone: "Europe/Paris" })).resolves.toEqual({
      ok: false,
      error: "Jarvis n’a pas répondu.",
    });

    const missing = {
      from: () => ({
        select: () => ({
          order: () => ({
            limit: async () => ({ data: null, error: { message: "missing" } }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    await expect(loadChatLines(missing)).resolves.toEqual({
      ok: false,
      error: "Les messages enregistrés ne sont pas disponibles.",
    });
  });
});
