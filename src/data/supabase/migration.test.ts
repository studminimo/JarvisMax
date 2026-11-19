declare const __dirname: string;
declare const require: (id: "fs" | "path") => {
  readFileSync(path: string, encoding: "utf8"): string;
  join(...parts: string[]): string;
};

const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "../../../supabase/migrations/20261119070000_profiles.sql"), "utf8");
const tasks = fs.readFileSync(path.join(__dirname, "../../../supabase/migrations/20261119140000_tasks.sql"), "utf8");
const chat = fs.readFileSync(path.join(__dirname, "../../../supabase/migrations/20261119150000_chat.sql"), "utf8");
const coach = fs.readFileSync(path.join(__dirname, "../../../supabase/migrations/20261119160000_coach.sql"), "utf8");
const webPush = fs.readFileSync(path.join(__dirname, "../../../supabase/migrations/20261119170000_web_push.sql"), "utf8");
const remindersFunction = fs.readFileSync(path.join(__dirname, "../../../supabase/functions/reminders/index.ts"), "utf8");
const chatFunction = fs.readFileSync(path.join(__dirname, "../../../supabase/functions/chat/index.ts"), "utf8");

describe("migration profiles", () => {
  it("isole chaque profil derrière auth.uid() et n’embarque aucun secret", () => {
    expect(sql).toMatch(/create table public\.profiles/i);
    expect(sql).toMatch(/user_id uuid not null unique references auth\.users/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/auth\.uid\(\) = user_id/);
    expect(sql).toContain("given_name");
    expect(sql).toContain("time_zone");
    expect(sql).toContain("notification_profile");
    expect(sql.toLowerCase()).not.toContain("service_role");
    expect(sql).not.toContain("sk-");
  });
});

describe("migration tasks", () => {
  it("isole chaque tâche derrière auth.uid() et n’embarque aucun secret", () => {
    expect(tasks).toMatch(/create table public\.tasks/i);
    expect(tasks).toMatch(/enable row level security/i);
    expect(tasks).toMatch(/auth\.uid\(\) = user_id/);
    expect(tasks).toContain("recurrence");
    expect(tasks.toLowerCase()).not.toContain("service_role");
    expect(tasks).not.toContain("sk-");
  });
});

describe("migration conversation", () => {
  it("isole les messages et les souvenirs, et la fonction n’utilise pas la clé service", () => {
    expect(chat).toMatch(/create table public\.conversations/i);
    expect(chat).toMatch(/create table public\.messages/i);
    expect(chat).toMatch(/create table public\.memories/i);
    expect(chat).toMatch(/enable row level security/i);
    expect(chat).toMatch(/auth\.uid\(\) = user_id/);
    expect(chat).toContain("sensitive");
    expect(chat).toContain("confirmed_suggestion");
    expect(chat.toLowerCase()).not.toContain("service_role");
    expect(chat).not.toContain("sk-");
    expect(chatFunction).toContain("OPENAI_API_KEY");
    expect(chatFunction).toContain("SUPABASE_ANON_KEY");
    expect(chatFunction).toContain('bearerRole(auth) === "service_role"');
    expect(chatFunction).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(chatFunction).not.toContain("sk-");
  });
});

describe("migration coach", () => {
  it("isole les routines, objectifs, habitudes et notes derrière auth.uid()", () => {
    expect(coach).toMatch(/create table public\.routines/i);
    expect(coach).toMatch(/create table public\.goals/i);
    expect(coach).toMatch(/create table public\.habits/i);
    expect(coach).toMatch(/create table public\.reviews/i);
    expect(coach).toContain("coach_mode");
    expect(coach).toMatch(/enable row level security/i);
    expect(coach).toMatch(/auth\.uid\(\) = user_id/);
    expect(coach.toLowerCase()).not.toContain("service_role");
    expect(coach).not.toContain("sk-");
  });
});

describe("migration rappels web", () => {
  it("isole les abonnements et prépare les envois sans clé dans le SQL", () => {
    expect(webPush).toMatch(/create table public\.push_subscriptions/i);
    expect(webPush).toMatch(/create table public\.scheduled_pushes/i);
    expect(webPush).toMatch(/enable row level security/i);
    expect(webPush).toMatch(/auth\.uid\(\) = user_id/);
    expect(webPush).toContain("sent_at is null");
    expect(webPush.toLowerCase()).not.toContain("service_role");
    expect(webPush).not.toContain("sk-");
    expect(remindersFunction).toContain("REMINDERS_CRON_SECRET");
    expect(remindersFunction).toContain("VAPID_PRIVATE_KEY");
    expect(remindersFunction).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(remindersFunction).not.toContain("sk-");
  });
});
