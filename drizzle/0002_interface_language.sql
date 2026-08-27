-- The interface follows the workspace, not the account.
--
-- Reading "Vocabulary" while learning Japanese teaches nothing; reading "単語"
-- does. So each space is written in the language it practises, and the choice
-- to fall back to Portuguese belongs to that space rather than to the whole
-- account — otherwise translating the Japanese one would also translate the
-- Spanish one, which needs no help.
--
-- NULL means "the language being practised". Only an explicit 'pt' overrides it.

ALTER TABLE "workspaces" ADD COLUMN "interface_language" text;--> statement-breakpoint

-- Anyone who had asked for a Portuguese interface keeps it, on every space they
-- own, rather than being dropped into immersion without warning.
UPDATE "workspaces" w
SET "interface_language" = 'pt'
FROM "user_settings" s
WHERE s."user_id" = w."user_id" AND s."interface_language" = 'pt';--> statement-breakpoint

ALTER TABLE "user_settings" DROP COLUMN "interface_language";
