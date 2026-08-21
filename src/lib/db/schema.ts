import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

const timestamp = (name: string) =>
  integer(name, { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)

/* ------------------------------------------------------------------ users */

export const users = sqliteTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at'),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
)

/** Server-side session store. The cookie holds a token; only its hash lives here. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(), // sha256(token)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: timestamp('created_at'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/* --------------------------------------------------------------- profiles */

export const ENGLISH_LEVELS = [
  'beginner',
  'elementary',
  'intermediate',
  'upper-intermediate',
  'advanced',
] as const
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number]

export const MAIN_GOALS = [
  'travel',
  'career',
  'studies',
  'interviews',
  'daily-conversation',
  'fluency',
] as const
export type MainGoal = (typeof MAIN_GOALS)[number]

/** The evolving linguistic profile. One row per user. */
export const profiles = sqliteTable('profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  level: text('level').notNull().default('intermediate').$type<EnglishLevel>(),
  autoAdaptLevel: integer('auto_adapt_level', { mode: 'boolean' }).notNull().default(true),
  estimatedCefr: text('estimated_cefr'), // A1..C2, derived from session reports
  mainGoal: text('main_goal').$type<MainGoal>(),
  dailyMinutesGoal: integer('daily_minutes_goal').notNull().default(20),
  nativeLanguage: text('native_language').notNull().default('pt-BR'),
  interests: text('interests', { mode: 'json' }).$type<string[]>().notNull().default([]),
  strengths: text('strengths', { mode: 'json' }).$type<string[]>().notNull().default([]),
  weaknesses: text('weaknesses', { mode: 'json' }).$type<string[]>().notNull().default([]),
  xp: integer('xp').notNull().default(0),
  streakCurrent: integer('streak_current').notNull().default(0),
  streakLongest: integer('streak_longest').notNull().default(0),
  lastPracticeDate: text('last_practice_date'), // YYYY-MM-DD, user local day
  totalPracticeSeconds: integer('total_practice_seconds').notNull().default(0),
  sessionsCompleted: integer('sessions_completed').notNull().default(0),
  onboardedAt: integer('onboarded_at', { mode: 'timestamp_ms' }),
  updatedAt: timestamp('updated_at'),
})

/** Secrets and preferences, kept apart from the learning profile. */
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  // AES-256-GCM payload of the user's own OpenAI key. Never leaves the server.
  openaiKeyCipher: text('openai_key_cipher'),
  openaiKeyHint: text('openai_key_hint'), // last 4 chars, safe to display
  openaiKeyVerifiedAt: integer('openai_key_verified_at', { mode: 'timestamp_ms' }),
  openaiKeyStatus: text('openai_key_status')
    .$type<'unset' | 'ok' | 'invalid'>()
    .notNull()
    .default('unset'),
  chatModel: text('chat_model'),
  sttModel: text('stt_model'),
  ttsModel: text('tts_model'),
  voice: text('voice').notNull().default('alloy'),
  theme: text('theme').notNull().default('system').$type<'system' | 'light' | 'dark'>(),
  updatedAt: timestamp('updated_at'),
})

/* ---------------------------------------------------------- conversations */

export const conversations = sqliteTable(
  'conversations',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topicId: text('topic_id'), // null for custom topics
    topicLabel: text('topic_label').notNull(),
    category: text('category').notNull().default('custom'),
    customBrief: text('custom_brief'),
    level: text('level').notNull().$type<EnglishLevel>(),
    status: text('status').notNull().default('active').$type<'active' | 'completed'>(),
    startedAt: timestamp('started_at'),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    userTurns: integer('user_turns').notNull().default(0),
  },
  (t) => [index('conversations_user_idx').on(t.userId, t.startedAt)],
)

export const conversationMessages = sqliteTable(
  'conversation_messages',
  {
    id: id(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    role: text('role').notNull().$type<'user' | 'assistant'>(),
    content: text('content').notNull(),
    audioMs: integer('audio_ms'),
    createdAt: timestamp('created_at'),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.seq)],
)

export const CORRECTION_CATEGORIES = [
  'grammar',
  'vocabulary',
  'prepositions',
  'pronunciation',
  'sentence-structure',
  'naturalness',
] as const
export type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number]

/** One correction shown in the live feedback panel. */
export const corrections = sqliteTable(
  'corrections',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: text('message_id').references(() => conversationMessages.id, {
      onDelete: 'cascade',
    }),
    category: text('category').notNull().$type<CorrectionCategory>(),
    original: text('original').notNull(),
    corrected: text('corrected').notNull(),
    explanation: text('explanation'),
    betterSentence: text('better_sentence'),
    severity: integer('severity').notNull().default(2), // 1 minor .. 3 important
    createdAt: timestamp('created_at'),
  },
  (t) => [index('corrections_conversation_idx').on(t.conversationId)],
)

export const sessionReports = sqliteTable(
  'session_reports',
  {
    id: id(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    speaking: integer('speaking').notNull(),
    grammar: integer('grammar').notNull(),
    vocabulary: integer('vocabulary').notNull(),
    fluency: integer('fluency').notNull(),
    pronunciation: integer('pronunciation'), // null when there is not enough signal
    estimatedLevel: text('estimated_level').notNull(),
    summary: text('summary').notNull(),
    mainMistakes: text('main_mistakes', { mode: 'json' })
      .$type<{ label: string; detail: string }[]>()
      .notNull()
      .default([]),
    newWords: text('new_words', { mode: 'json' })
      .$type<{ word: string; meaning: string }[]>()
      .notNull()
      .default([]),
    expressions: text('expressions', { mode: 'json' })
      .$type<{ expression: string; meaning: string }[]>()
      .notNull()
      .default([]),
    recommendations: text('recommendations', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
    wordsSpoken: integer('words_spoken').notNull().default(0),
    createdAt: timestamp('created_at'),
  },
  (t) => [uniqueIndex('reports_conversation_unique').on(t.conversationId)],
)

/* -------------------------------------------------------------- mistakes */

/** Aggregated recurring mistake, deduplicated per user by `signature`. */
export const mistakes = sqliteTable(
  'mistakes',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull().$type<CorrectionCategory>(),
    signature: text('signature').notNull(), // normalized "original>corrected"
    original: text('original').notNull(),
    corrected: text('corrected').notNull(),
    explanation: text('explanation'),
    occurrences: integer('occurrences').notNull().default(1),
    status: text('status').notNull().default('open').$type<'open' | 'improving' | 'resolved'>(),
    firstSeenAt: timestamp('first_seen_at'),
    lastSeenAt: timestamp('last_seen_at'),
  },
  (t) => [
    uniqueIndex('mistakes_user_signature_unique').on(t.userId, t.signature),
    index('mistakes_user_occurrences_idx').on(t.userId, t.occurrences),
  ],
)

export const mistakeOccurrences = sqliteTable(
  'mistake_occurrences',
  {
    id: id(),
    mistakeId: text('mistake_id')
      .notNull()
      .references(() => mistakes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),
    sentence: text('sentence'),
    createdAt: timestamp('created_at'),
  },
  (t) => [index('occurrences_mistake_idx').on(t.mistakeId, t.createdAt)],
)

/* ------------------------------------------------------------ vocabulary */

export const vocabulary = sqliteTable(
  'vocabulary',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    partOfSpeech: text('part_of_speech'),
    phonetic: text('phonetic'),
    definition: text('definition').notNull(),
    example: text('example'),
    translation: text('translation'),
    audioUrl: text('audio_url'),
    related: text('related', { mode: 'json' }).$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('learning').$type<'learning' | 'learned' | 'review'>(),
    source: text('source').notNull().default('dictionary').$type<'dictionary' | 'conversation'>(),
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [uniqueIndex('vocabulary_user_word_unique').on(t.userId, t.word)],
)

/* ----------------------------------------------------------------- goals */

export const GOAL_KINDS = [
  'weekly_sessions',
  'weekly_minutes',
  'weekly_words',
  'weekly_mistakes',
] as const
export type GoalKind = (typeof GOAL_KINDS)[number]

export const goals = sqliteTable(
  'goals',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().$type<GoalKind>(),
    target: integer('target').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: timestamp('created_at'),
  },
  (t) => [uniqueIndex('goals_user_kind_unique').on(t.userId, t.kind)],
)

/* ---------------------------------------------------------- gamification */

export const achievements = sqliteTable('achievements', {
  id: text('id').primaryKey(), // slug
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  xp: integer('xp').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const userAchievements = sqliteTable(
  'user_achievements',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    unlockedAt: timestamp('unlocked_at'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
)

/** One row per user per local day — the source of truth for streaks. */
export const streaks = sqliteTable(
  'streaks',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: text('day').notNull(), // YYYY-MM-DD in the user's local timezone
    seconds: integer('seconds').notNull().default(0),
    sessions: integer('sessions').notNull().default(0),
    xp: integer('xp').notNull().default(0),
  },
  (t) => [uniqueIndex('streaks_user_day_unique').on(t.userId, t.day)],
)

/** Every XP-earning activity, for the timeline and weekly goals. */
export const practiceSessions = sqliteTable(
  'practice_sessions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    kind: text('kind').notNull().$type<'conversation' | 'vocabulary' | 'review'>(),
    seconds: integer('seconds').notNull().default(0),
    xpEarned: integer('xp_earned').notNull().default(0),
    score: real('score'),
    createdAt: timestamp('created_at'),
  },
  (t) => [index('practice_user_idx').on(t.userId, t.createdAt)],
)

/* -------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
  conversations: many(conversations),
  vocabulary: many(vocabulary),
  mistakes: many(mistakes),
}))

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(conversationMessages),
  corrections: many(corrections),
  report: one(sessionReports, {
    fields: [conversations.id],
    references: [sessionReports.conversationId],
  }),
}))

export const messagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMessages.conversationId],
    references: [conversations.id],
  }),
}))

export const mistakesRelations = relations(mistakes, ({ many }) => ({
  occurrences: many(mistakeOccurrences),
}))
