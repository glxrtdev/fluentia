-- Workspaces: one language per space, several per account.
--
-- Hand-written rather than generated. The generated version added
-- `workspace_id NOT NULL` to tables that already hold rows, which cannot
-- succeed, and dropped the profile columns before anything had copied their
-- values anywhere. Each learning table is therefore widened as nullable,
-- backfilled, and only then tightened.

CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"language" text NOT NULL,
	"level" text DEFAULT 'intermediate' NOT NULL,
	"auto_adapt_level" boolean DEFAULT true NOT NULL,
	"estimated_cefr" text,
	"main_goal" text,
	"daily_minutes_goal" integer DEFAULT 20 NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weaknesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_practice_seconds" integer DEFAULT 0 NOT NULL,
	"sessions_completed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_user_language_unique" ON "workspaces" USING btree ("user_id","language");--> statement-breakpoint
CREATE INDEX "workspaces_user_idx" ON "workspaces" USING btree ("user_id","created_at");--> statement-breakpoint

-- Everyone who already had a profile was learning English. Give them an
-- English workspace carrying the progress they had built up.
INSERT INTO "workspaces" (
	"id", "user_id", "language", "level", "auto_adapt_level", "estimated_cefr",
	"main_goal", "daily_minutes_goal", "interests", "strengths", "weaknesses",
	"total_practice_seconds", "sessions_completed", "created_at", "updated_at"
)
SELECT
	gen_random_uuid()::text, "user_id", 'en', "level", "auto_adapt_level",
	"estimated_cefr", "main_goal", "daily_minutes_goal", "interests", "strengths",
	"weaknesses", "total_practice_seconds", "sessions_completed", now(), now()
FROM "profiles";--> statement-breakpoint

-- Widen, backfill, then tighten. Every existing row belongs to its owner's one
-- and only workspace.
ALTER TABLE "conversations" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "mistakes" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "vocabulary" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "workspace_id" text;--> statement-breakpoint

UPDATE "conversations" c SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = c."user_id";--> statement-breakpoint
UPDATE "goals" g SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = g."user_id";--> statement-breakpoint
UPDATE "mistakes" m SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = m."user_id";--> statement-breakpoint
UPDATE "vocabulary" v SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = v."user_id";--> statement-breakpoint
UPDATE "practice_sessions" p SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = p."user_id";--> statement-breakpoint
UPDATE "session_reports" r SET "workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = r."user_id";--> statement-breakpoint

-- A row whose owner somehow has no workspace would block the NOT NULL below,
-- and it can no longer be reached from anywhere in the app either.
DELETE FROM "conversations" WHERE "workspace_id" IS NULL;--> statement-breakpoint
DELETE FROM "goals" WHERE "workspace_id" IS NULL;--> statement-breakpoint
DELETE FROM "mistakes" WHERE "workspace_id" IS NULL;--> statement-breakpoint
DELETE FROM "vocabulary" WHERE "workspace_id" IS NULL;--> statement-breakpoint
DELETE FROM "session_reports" WHERE "workspace_id" IS NULL;--> statement-breakpoint

ALTER TABLE "conversations" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "mistakes" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vocabulary" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_reports" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary" ADD CONSTRAINT "vocabulary_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Uniqueness moves to the workspace: the same word, or the same slip, may
-- legitimately appear in two different languages.
DROP INDEX IF EXISTS "mistakes_user_signature_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "mistakes_user_occurrences_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "vocabulary_user_word_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "goals_user_kind_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "conversations_user_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "mistakes_workspace_signature_unique" ON "mistakes" USING btree ("workspace_id","signature");--> statement-breakpoint
CREATE INDEX "mistakes_workspace_occurrences_idx" ON "mistakes" USING btree ("workspace_id","occurrences");--> statement-breakpoint
CREATE UNIQUE INDEX "vocabulary_workspace_word_unique" ON "vocabulary" USING btree ("workspace_id","word");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_workspace_kind_unique" ON "goals" USING btree ("workspace_id","kind");--> statement-breakpoint
CREATE INDEX "conversations_workspace_idx" ON "conversations" USING btree ("workspace_id","started_at");--> statement-breakpoint

-- Settings: which space is open, and what language the interface speaks.
ALTER TABLE "user_settings" ADD COLUMN "active_workspace_id" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "interface_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
UPDATE "user_settings" s SET "active_workspace_id" = w."id" FROM "workspaces" w WHERE w."user_id" = s."user_id";--> statement-breakpoint

-- Only now that the values live on the workspace.
ALTER TABLE "profiles" DROP COLUMN "level";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "auto_adapt_level";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "estimated_cefr";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "main_goal";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "daily_minutes_goal";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "interests";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "strengths";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "weaknesses";
