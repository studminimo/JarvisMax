import { err, ok, type Result } from "./result";

export const MEMORY_CATEGORIES = ["preference", "fact", "person", "health", "finance", "private"] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_LABELS: Record<MemoryCategory, string> = {
  preference: "Préférence",
  fact: "Fait",
  person: "Personne",
  health: "Santé",
  finance: "Argent",
  private: "Privé",
};

export const MEMORY_CONTENT_LIMIT = 400;

const SENSITIVE: readonly MemoryCategory[] = ["health", "finance", "private"];
const MEMORY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MemoryOrigin = "user" | "confirmed_suggestion";

export type Memory = {
  id: string;
  content: string;
  category: MemoryCategory;
  sensitive: boolean;
  origin: MemoryOrigin;
};

export type MemoryWrite = {
  content: string;
  category: MemoryCategory;
  sensitive: boolean;
  origin: MemoryOrigin;
};

export function isMemoryCategory(value: string): value is MemoryCategory {
  return (MEMORY_CATEGORIES as readonly string[]).includes(value);
}

export function isSensitiveCategory(category: MemoryCategory): boolean {
  return SENSITIVE.includes(category);
}

export function prepareMemory(input: {
  content: string;
  category: string;
  agreed: boolean;
  origin?: MemoryOrigin;
}): Result<MemoryWrite> {
  const content = input.content.trim();
  if (content.length < 1) {
    return err("Le souvenir est vide.");
  }
  if (content.length > MEMORY_CONTENT_LIMIT) {
    return err(`${MEMORY_CONTENT_LIMIT} caractères maximum.`);
  }
  if (!isMemoryCategory(input.category)) {
    return err("Catégorie inconnue.");
  }
  const sensitive = isSensitiveCategory(input.category);
  if (sensitive && !input.agreed) {
    return err("Tu confirmes d’enregistrer cette information sensible ?");
  }
  return ok({
    content,
    category: input.category,
    sensitive,
    origin: input.origin === "confirmed_suggestion" ? "confirmed_suggestion" : "user",
  });
}

export function memoryFromRow(value: unknown): Memory | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !MEMORY_ID.test(row.id) || typeof row.content !== "string") {
    return null;
  }
  const content = row.content.trim();
  if (content.length < 1 || content.length > MEMORY_CONTENT_LIMIT || typeof row.category !== "string" || !isMemoryCategory(row.category)) {
    return null;
  }
  const sensitive = isSensitiveCategory(row.category);
  if (row.sensitive !== sensitive || (row.origin !== "user" && row.origin !== "confirmed_suggestion")) {
    return null;
  }
  return { id: row.id, content, category: row.category, sensitive, origin: row.origin };
}

export function sameMemory(left: Memory, right: Memory): boolean {
  return (
    left.id === right.id &&
    left.content === right.content &&
    left.category === right.category &&
    left.sensitive === right.sensitive &&
    left.origin === right.origin
  );
}
