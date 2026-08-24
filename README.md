# Fluentia

A voice-first English tutor. You talk out loud, it listens, answers in voice, and writes the
corrections that matter beside you — without ever interrupting the conversation to read them.

Fluentia runs on **your own OpenAI key**. There are no credits, no subscription and no shared key:
transcription, replies and speech are billed straight to your account.

---

## The loop

```
   ┌──────────┐   MediaRecorder    ┌───────────────────────────────┐
   │  learner │ ─────────────────▶ │ POST /api/conversations/:id/  │
   │  speaks  │      webm/opus     │              turn             │
   └──────────┘                    │                               │
         ▲                         │  1. speech → text  (STT)      │
         │                         │  2. text + profile + history  │
         │                         │     → reply + corrections     │
         │                         │        (one JSON-schema call) │
         │                         │  3. persist turn, corrections │
         │                         │     and the mistake ledger    │
         │                         └───────────────┬───────────────┘
         │                                         │
         │        GET /api/speech?messageId=…      ▼
         └────────────  audio/mpeg stream  ── teacher speaks
                                                   │
                            corrections render in the side panel,
                            silently, while the teacher keeps talking
```

The reply and its corrections come from a **single** model call with a strict JSON schema, so they
can never disagree with each other, and the spoken text is prompted to contain no correction
language at all. Speech is a separate streaming `GET` keyed by message id, which means the browser
plays it natively as it arrives and a replay costs nothing.

When the session ends, the transcript is scored, the report is stored, the learning profile is
updated (CEFR estimate, strengths, weak spots, level nudge) and XP, streak and achievements are
recalculated from real rows.

---

## Stack and why

| Concern | Choice | Reason |
| --- | --- | --- |
| App | Next.js (App Router) + TypeScript | server routes live beside the UI, so the API key never reaches the client |
| UI | Tailwind CSS v4, design tokens in `globals.css`, Lucide icons | one small design system, light and dark from the same tokens |
| Database | **Supabase Postgres** + Drizzle ORM | managed, works on serverless, and the connection string is the only credential the app needs |
| Auth | own session cookies (`scrypt` + hashed opaque tokens) | no SaaS dependency, 30-day persistent sessions, no JWT footguns |
| API key | AES-256-GCM at rest, decrypted only inside the request that calls OpenAI | a database dump alone reveals nothing |
| Speech | `gpt-4o-transcribe` → `gpt-4o` → `gpt-4o-mini-tts` (all overridable) | text arrives first so corrections paint immediately; audio streams after |
| Dictionary | [dictionaryapi.dev](https://dictionaryapi.dev) | real definitions instead of a model inventing them |

---

## Running it

```bash
npm install
npm run setup        # writes .env.local with a fresh ENCRYPTION_KEY
# paste your Supabase connection string into DATABASE_URL in .env.local
npm run dev          # applies migrations, then starts the app
```

Then:

1. open <http://localhost:3000> and create an account;
2. finish the four onboarding steps;
3. go to **Settings → AI configuration** and paste your OpenAI key (it is verified live);
4. open **Speaking**, pick a topic, and talk.

`npm run dev` runs `setup` and `db:migrate` first, so the schema is applied and the achievement
catalogue is seeded before the server starts.

### Environment

`npm run setup` creates `.env.local` with a fresh key. The database URL is a credential, so it is never invented for you:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Supabase connection string (Project Settings → Database → Connection string → URI) |
| `ENCRYPTION_KEY` | 32-byte hex key that encrypts each user's OpenAI key |
| `OPENAI_CHAT_MODEL` / `OPENAI_STT_MODEL` / `OPENAI_TTS_MODEL` | optional defaults, overridable per user in Settings |
| `OPENAI_BASE_URL` | optional; point at an OpenAI-compatible gateway (also used by the voice-loop test) |

> `ENCRYPTION_KEY` is the only secret that matters: rotate it and every stored API key becomes
> unreadable, so users would need to paste theirs again.

> Use the **Transaction pooler** URI (port 6543) for serverless deployments; the app already sets
> `prepare: false`, which is what that pooler requires. A long-running server can use the Session
> pooler or the direct connection instead.

> The connection string is a full-access database credential: it belongs in server-side environment
> variables only. Supabase Row Level Security is **not** what isolates users here — the app does,
> by filtering every query on the session user id.

### Scripts

```bash
npm run dev          # migrate + dev server
npm run build        # migrate + production build (type-checked)
npm start            # migrate + production server
npm run typecheck
npm test             # migration shape + date/streak unit tests (no database needed)
npm run test:smoke http://localhost:3000    # pages, auth guards, per-user isolation
npm run test:voice  http://localhost:3000 4319   # the full voice loop against a mock OpenAI
npm run db:generate # new migration after editing the schema
npm run db:studio   # browse the database
```

`test:voice` needs the app started with `OPENAI_BASE_URL=http://127.0.0.1:4319/v1`. It stands up an
OpenAI-compatible test double and drives the whole loop — audio upload, transcript, reply,
corrections, mistake aggregation, speech streaming, report, XP, streak, achievements — without
spending a cent.

---

## Data model

Everything hangs off `users` and every query is filtered by the session's user id.

```
users ──┬── profiles              level, CEFR estimate, XP, streak, strengths, weaknesses
        ├── user_settings         encrypted OpenAI key, model + voice preferences, theme
        ├── sessions              hashed session tokens
        ├── conversations ──┬── conversation_messages    the transcript, ordered by seq
        │                   ├── corrections              what the feedback panel showed
        │                   └── session_reports          scores, mistakes, words, advice
        ├── mistakes ─────── mistake_occurrences         recurring patterns, with counts
        ├── vocabulary                                   learning / review / learned
        ├── goals                                        weekly targets
        ├── streaks                                      one row per practised day
        ├── practice_sessions                            every XP-earning activity
        └── user_achievements ── achievements            catalogue seeded from code
```

`streaks` is the source of truth for the streak; `profiles` keeps a denormalised copy so the
dashboard is a single read. Weekly goal progress is always computed from real rows, never stored.

---

## Security notes

- **API keys** are encrypted with AES-256-GCM (`src/lib/crypto.ts`) and only decrypted inside
  `getUserAi()`. No route ever returns a key, not even masked beyond its last four characters.
- **Sessions** are opaque 32-byte tokens in `httpOnly`, `sameSite=lax` cookies; only their SHA-256
  is stored, so the database cannot be used to impersonate anyone.
- **Passwords** use `scrypt` with a per-password salt and constant-time comparison.
- **Isolation** — every conversation, message, correction, mistake and word is fetched with the
  user id in the `WHERE` clause. `npm run test:smoke` asserts that a second account gets `404` on
  all of them, including the audio endpoint.
- **Input** is validated with Zod at every boundary (`src/lib/validation.ts`), including audio size
  and MIME type on upload.
- **Rate limits** guard sign-in, session starts, turns, speech and dictionary lookups.
- **Cascades** — deleting a user removes every row they own, enforced by foreign keys rather than
  application code.
- **Audio** is streamed to OpenAI and never written to disk; Fluentia keeps the text.

---

## Layout

```
src/
  app/
    (auth)/          login, signup
    (app)/           the signed-in shell: dashboard, speak, sessions, mistakes,
                     vocabulary, profile, goals, achievements, settings
    onboarding/      four-step first run
    api/             conversations/:id/turn · conversations/:id/end · speech · dictionary · translate
  components/        brand, shell, conversation, settings, vocabulary, ui primitives
  lib/
    auth/            session issuing, guards, sign-in/up actions
    db/              Drizzle schema, connection, achievement seed
    domain/          conversation, mistakes, report, gamification, recommendations, topics
    openai/          client, prompts + JSON schemas, turn, speech
    actions/         server actions grouped by feature
    hooks/           use-recorder (voice activity detection)
tests/               schema, date/streak units, smoke, voice loop
```

---

## Known limits

- **Pronunciation** is scored only when the transcript actually shows evidence; otherwise the report
  shows a dash rather than inventing a number. Real pronunciation assessment needs the audio itself.
- **Turn taking** is push-to-talk with silence detection, not a full duplex realtime stream. It is
  simpler, cheaper and works on every browser that has `MediaRecorder`; the Realtime API would be
  the next step for barge-in.
- **Rate limiting** is in-process, which is correct for a single instance. Multiple nodes would
  need a shared store.
- **Translations** are on demand only. Every translation is an OpenAI call billed to the learner, so
  Fluentia never translates a word until the learner presses the button.
