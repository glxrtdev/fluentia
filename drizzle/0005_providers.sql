-- More than one AI provider.
--
-- Only providers that can do all three jobs on their own are offered: hear
-- (speech to text), think (a reply plus corrections under a JSON schema), and
-- speak (text to speech). Anthropic is deliberately absent — Claude reasons
-- well but its API takes text, images and PDFs and returns text, so a Claude
-- workspace would still need a second account underneath it to hold a
-- conversation.
--
-- Keys are stored per provider rather than in one slot, so switching to Gemini
-- and back does not cost you the OpenAI key you already pasted.

ALTER TABLE "user_settings" ADD COLUMN "ai_provider" text DEFAULT 'openai' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "gemini_key_cipher" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "gemini_key_hint" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "gemini_key_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "gemini_key_status" text DEFAULT 'unset' NOT NULL;
