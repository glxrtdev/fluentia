-- The interface is Portuguese, always.
--
-- The per-workspace choice existed so a space could be written in the language
-- it practises, with a way back. That is gone: what the learner is learning
-- appears in the target language — their own mistakes, saved words, the
-- transcript, the teacher's voice — and everything the app itself says is in
-- Portuguese, whichever space is open. Nothing to choose, so nothing to store.

ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "interface_language";
