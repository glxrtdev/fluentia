import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

const stamp = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' }).notNull().defaultNow()

const optionalStamp = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: stamp('created_at'),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
)

/** Server-side session store. The cookie holds a token; only its hash lives here. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // sha256(token)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: stamp('created_at'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/* --------------------------------------------------------------- profiles */

export const LEVELS = [
  'beginner',
  'elementary',
  'intermediate',
  'upper-intermediate',
  'advanced',
] as const
export type Level = (typeof LEVELS)[number]

/** @deprecated Kept so older imports keep compiling. Use `LEVELS` / `Level`. */
export const ENGLISH_LEVELS = LEVELS
export type EnglishLevel = Level

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
/**
 * What belongs to the person rather than to any one language.
 *
 * Practising Japanese on Tuesday should not break the streak built in English,
 * so the daily habit and the XP that rewards it live here, once per account.
 * Everything that describes progress *in a language* lives on the workspace.
 */
export const profiles = pgTable('profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  nativeLanguage: text('native_language').notNull().default('pt-BR'),
  xp: integer('xp').notNull().default(0),
  streakCurrent: integer('streak_current').notNull().default(0),
  streakLongest: integer('streak_longest').notNull().default(0),
  lastPracticeDate: text('last_practice_date'), // YYYY-MM-DD, user local day
  totalPracticeSeconds: integer('total_practice_seconds').notNull().default(0),
  sessionsCompleted: integer('sessions_completed').notNull().default(0),
  onboardedAt: optionalStamp('onboarded_at'),
  updatedAt: stamp('updated_at'),
})

/* ------------------------------------------------------------- workspaces */

/**
 * One language a learner is practising. An account may hold a few at once, and
 * every piece of learning — level, mistakes, vocabulary, sessions, goals — is
 * scoped to exactly one of them.
 */
export const workspaces = pgTable(
  'workspaces',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    language: text('language').notNull(), // LanguageCode from lib/languages
    level: text('level').notNull().default('intermediate').$type<Level>(),
    autoAdaptLevel: boolean('auto_adapt_level').notNull().default(true),
    /*
     * The level the learner actually holds. It moves only through the
     * consistency run in `domain/progression`, never through XP or session
     * count — someone can be rich in XP and still be A2.
     */
    officialCefr: text('official_cefr').notNull().default('A1'),
    /** 0-100 towards the top of the current band. A ratchet at 100. */
    levelProgress: integer('level_progress').notNull().default(0),
    /** Consecutive sessions already scored inside the next band. */
    consistencyStreak: integer('consistency_streak').notNull().default(0),
    /**
     * When the current level was reached. The progress window only looks at
     * sessions after this, so a new level starts from zero rather than
     * inheriting the average that earned it.
     */
    levelAchievedAt: stamp('level_achieved_at'),
    /** The band the last session fell into. Informational, not the level. */
    estimatedCefr: text('estimated_cefr'), // A1..C2, from the last session
    mainGoal: text('main_goal').$type<MainGoal>(),
    dailyMinutesGoal: integer('daily_minutes_goal').notNull().default(20),
    interests: jsonb('interests').$type<string[]>().notNull().default([]),
    strengths: jsonb('strengths').$type<string[]>().notNull().default([]),
    weaknesses: jsonb('weaknesses').$type<string[]>().notNull().default([]),
    totalPracticeSeconds: integer('total_practice_seconds').notNull().default(0),
    sessionsCompleted: integer('sessions_completed').notNull().default(0),
    createdAt: stamp('created_at'),
    updatedAt: stamp('updated_at'),
  },
  (t) => [
    // One workspace per language per account: two English spaces would split
    // the same learner's history for no reason.
    uniqueIndex('workspaces_user_language_unique').on(t.userId, t.language),
    index('workspaces_user_idx').on(t.userId, t.createdAt),
  ],
)

/** Secrets and preferences, kept apart from the learning profile. */
export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  // AES-256-GCM payload of the user's own OpenAI key. Never leaves the server.
  openaiKeyCipher: text('openai_key_cipher'),
  openaiKeyHint: text('openai_key_hint'), // last 4 chars, safe to display
  openaiKeyVerifiedAt: optionalStamp('openai_key_verified_at'),
  openaiKeyStatus: text('openai_key_status')
    .$type<'unset' | 'ok' | 'invalid'>()
    .notNull()
    .default('unset'),
  chatModel: text('chat_model'),
  sttModel: text('stt_model'),
  ttsModel: text('tts_model'),
  voice: text('voice').notNull().default('alloy'),
  theme: text('theme').notNull().default('system').$type<'system' | 'light' | 'dark'>(),
  /*
   * The workspace the learner last had open. Not a foreign key: deleting a
   * workspace would otherwise have to reach in here, and a stale id simply
   * falls back to the first workspace.
   */
  activeWorkspaceId: text('active_workspace_id'),
  updatedAt: stamp('updated_at'),
})

/* ---------------------------------------------------------- conversations */

export const conversations = pgTable(
  'conversations',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /*
     * Denormalised from the workspace on purpose. Every spoken turn needs the
     * language, and the conversation row is already loaded — looking it up
     * would add a round trip to a database on another continent, per turn.
     */
    language: text('language').notNull().default('en'),
    topicId: text('topic_id'), // null for custom topics
    topicLabel: text('topic_label').notNull(),
    category: text('category').notNull().default('custom'),
    customBrief: text('custom_brief'),
    level: text('level').notNull().$type<Level>(),
    status: text('status').notNull().default('active').$type<'active' | 'completed'>(),
    startedAt: stamp('started_at'),
    endedAt: optionalStamp('ended_at'),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    userTurns: integer('user_turns').notNull().default(0),
  },
  (t) => [index('conversations_user_idx').on(t.userId, t.startedAt)],
)

export const conversationMessages = pgTable(
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
    createdAt: stamp('created_at'),
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
export const corrections = pgTable(
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
    createdAt: stamp('created_at'),
  },
  (t) => [index('corrections_conversation_idx').on(t.conversationId)],
)

export const sessionReports = pgTable(
  'session_reports',
  {
    id: id(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
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
    /*
     * Whether this session counted towards levelling. Stored rather than
     * re-derived so "the last five valid sessions" stays one indexable query
     * and the rule that produced it is auditable after the fact.
     */
    countsTowardsLevel: boolean('counts_towards_level').notNull().default(false),
    /** Set when this very session earned a promotion, so the report can say so. */
    promotedTo: text('promoted_to'),
    summary: text('summary').notNull(),
    mainMistakes: jsonb('main_mistakes')
      .$type<{ label: string; detail: string }[]>()
      .notNull()
      .default([]),
    newWords: jsonb('new_words').$type<{ word: string; meaning: string }[]>().notNull().default([]),
    expressions: jsonb('expressions')
      .$type<{ expression: string; meaning: string }[]>()
      .notNull()
      .default([]),
    recommendations: jsonb('recommendations').$type<string[]>().notNull().default([]),
    wordsSpoken: integer('words_spoken').notNull().default(0),
    createdAt: stamp('created_at'),
  },
  (t) => [uniqueIndex('reports_conversation_unique').on(t.conversationId)],
)

/* -------------------------------------------------------------- mistakes */

/** Aggregated recurring mistake, deduplicated per user by `signature`. */
export const mistakes = pgTable(
  'mistakes',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    category: text('category').notNull().$type<CorrectionCategory>(),
    signature: text('signature').notNull(), // normalized "original>corrected"
    original: text('original').notNull(),
    corrected: text('corrected').notNull(),
    explanation: text('explanation'),
    occurrences: integer('occurrences').notNull().default(1),
    status: text('status').notNull().default('open').$type<'open' | 'improving' | 'resolved'>(),
    firstSeenAt: stamp('first_seen_at'),
    lastSeenAt: stamp('last_seen_at'),
  },
  (t) => [
    uniqueIndex('mistakes_workspace_signature_unique').on(t.workspaceId, t.signature),
    index('mistakes_workspace_occurrences_idx').on(t.workspaceId, t.occurrences),
  ],
)

export const mistakeOccurrences = pgTable(
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
    createdAt: stamp('created_at'),
  },
  (t) => [index('occurrences_mistake_idx').on(t.mistakeId, t.createdAt)],
)

/* ------------------------------------------------------------ vocabulary */

export const vocabulary = pgTable(
  'vocabulary',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    partOfSpeech: text('part_of_speech'),
    phonetic: text('phonetic'),
    definition: text('definition').notNull(),
    example: text('example'),
    translation: text('translation'),
    audioUrl: text('audio_url'),
    related: jsonb('related').$type<string[]>().notNull().default([]),
    status: text('status').notNull().default('learning').$type<'learning' | 'learned' | 'review'>(),
    source: text('source').notNull().default('dictionary').$type<'dictionary' | 'conversation'>(),
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: stamp('created_at'),
    updatedAt: stamp('updated_at'),
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

export const goals = pgTable(
  'goals',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().$type<GoalKind>(),
    target: integer('target').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: stamp('created_at'),
  },
  (t) => [uniqueIndex('goals_user_kind_unique').on(t.userId, t.kind)],
)

/* ---------------------------------------------------------- gamification */

export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(), // slug
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  xp: integer('xp').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    unlockedAt: stamp('unlocked_at'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.achievementId] })],
)

/** One row per user per local day — the source of truth for streaks. */
export const streaks = pgTable(
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
export const practiceSessions = pgTable(
  'practice_sessions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().$type<'conversation' | 'vocabulary' | 'review'>(),
    seconds: integer('seconds').notNull().default(0),
    xpEarned: integer('xp_earned').notNull().default(0),
    score: real('score'),
    createdAt: stamp('created_at'),
  },
  (t) => [index('practice_user_idx').on(t.userId, t.createdAt)],
)

/* -------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
  workspaces: many(workspaces),
}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  user: one(users, { fields: [workspaces.userId], references: [users.id] }),
  conversations: many(conversations),
  vocabulary: many(vocabulary),
  mistakes: many(mistakes),
  goals: many(goals),
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
