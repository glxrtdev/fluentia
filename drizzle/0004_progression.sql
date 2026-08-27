-- Level, progress and XP, finally separated.
--
-- The level used to drift on `estimated_cefr`, which was whatever the last
-- session happened to look like, and the teaching level nudged itself one step
-- per report. Neither was a claim the learner had earned. From here the level
-- moves only through a consistency run — five sessions held inside the next
-- band — and XP cannot touch it at all.

ALTER TABLE "workspaces" ADD COLUMN "official_cefr" text DEFAULT 'A1' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "level_progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "consistency_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "level_achieved_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint

ALTER TABLE "session_reports" ADD COLUMN "counts_towards_level" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "promoted_to" text;--> statement-breakpoint

-- Nobody loses ground on the way in. An existing learner keeps whatever band
-- their sessions had already estimated; the rest start where everyone starts.
UPDATE "workspaces"
SET "official_cefr" = "estimated_cefr"
WHERE "estimated_cefr" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint

-- Someone who never finished a scored session but declared a level at
-- onboarding keeps that as a starting point rather than being reset to A1.
UPDATE "workspaces"
SET "official_cefr" = CASE "level"
    WHEN 'beginner' THEN 'A1'
    WHEN 'elementary' THEN 'A2'
    WHEN 'intermediate' THEN 'B1'
    WHEN 'upper-intermediate' THEN 'B2'
    WHEN 'advanced' THEN 'C1'
    ELSE 'A1'
  END
WHERE "estimated_cefr" IS NULL;--> statement-breakpoint

-- Past reports predate the rule, so none of them counts towards a run. Their
-- scores are still history; they simply cannot retroactively promote anyone.
UPDATE "session_reports" SET "counts_towards_level" = false;
