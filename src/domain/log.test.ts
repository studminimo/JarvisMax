import { createLogger, redactSecrets } from "./log";

describe("journal technique", () => {
  it("masque une clé OpenAI ou un jeton, et laisse le texte intact", () => {
    expect(redactSecrets("Bonjour, rappel à 10 h.")).toBe("Bonjour, rappel à 10 h.");
    expect(redactSecrets("clé sk-abc123456789 dans le texte")).toBe("clé [redacted] dans le texte");
    expect(redactSecrets("sk-abcd")).toBe("sk-abcd");
    expect(redactSecrets("session eyJabc.def.ghi")).toBe("session [redacted]");
  });

  it("écrit un message déjà masqué", () => {
    const entries: { message: string; at: string; level: string }[] = [];
    const logger = createLogger((entry) => entries.push(entry), () => new Date("2026-11-18T10:00:00Z"));
    logger.error("échec eyJabc.def.ghi");
    expect(entries).toEqual([
      {
        level: "error",
        message: "échec [redacted]",
        at: "2026-11-18T10:00:00.000Z",
      },
    ]);
  });
});
