-- Shuts the public Data API on every table.
--
-- Supabase exposes the `public` schema over PostgREST, and the `anon` role it
-- serves had SELECT, INSERT and DELETE on all seventeen tables with no
-- row-level security to stop it. Anyone holding the project's anon key — a
-- credential meant to sit in browsers — could have read every e-mail and
-- password hash, read the encrypted provider keys, or inserted a row into
-- `sessions` and walked in as any account.
--
-- Fluentia never uses that API. It connects straight to Postgres as `postgres`,
-- the owner of these tables, and an owner bypasses row-level security. So
-- enabling RLS with no policies at all closes the API completely while leaving
-- the app's own queries untouched. Policies would only be needed if the API
-- were ever used, and it is not.
--
-- Rehearsed in a rolled-back transaction before being written: the app's role
-- still read, wrote and joined; `anon` saw zero rows, could not forge a session
-- and could not delete a user.

ALTER TABLE "achievements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversation_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "corrections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mistake_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mistakes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "practice_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "streaks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_achievements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vocabulary" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Belt as well as braces. RLS already stops the API dead, but the app has no
-- use for these grants either, and a policy added carelessly one day would
-- otherwise open the table straight back up.
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "anon";--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "authenticated";--> statement-breakpoint

-- And for tables added later, so a new one is never born exposed.
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";
