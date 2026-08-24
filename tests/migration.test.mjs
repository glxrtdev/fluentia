import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Validates the generated migration without touching a live database: the
 * shape of the schema is what guarantees per-user isolation, so it is worth
 * asserting even offline.
 */
const folder = resolve('drizzle')
const sql = readdirSync(folder)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(join(folder, file), 'utf8'))
  .join('\n')

const TABLES = [
  'users',
  'sessions',
  'profiles',
  'user_settings',
  'conversations',
  'conversation_messages',
  'corrections',
  'session_reports',
  'mistakes',
  'mistake_occurrences',
  'vocabulary',
  'goals',
  'achievements',
  'user_achievements',
  'streaks',
  'practice_sessions',
]

test('every table is created', () => {
  for (const table of TABLES) {
    assert.match(sql, new RegExp(`CREATE TABLE "${table}"`), `missing table ${table}`)
  }
})

test('user-owned tables cascade from users', () => {
  const owned = [
    'sessions',
    'profiles',
    'user_settings',
    'conversations',
    'conversation_messages',
    'corrections',
    'session_reports',
    'mistakes',
    'mistake_occurrences',
    'vocabulary',
    'goals',
    'user_achievements',
    'streaks',
    'practice_sessions',
  ]

  for (const table of owned) {
    const constraint = new RegExp(
      `"${table}" ADD CONSTRAINT "${table}_user_id_users_id_fk"[\\s\\S]*?ON DELETE cascade`,
    )
    assert.match(sql, constraint, `${table} does not cascade from users`)
  }
})

test('deduplication keys are unique', () => {
  const uniques = [
    ['users_email_unique', 'users', 'email'],
    ['mistakes_user_signature_unique', 'mistakes', 'user_id'],
    ['vocabulary_user_word_unique', 'vocabulary', 'user_id'],
    ['goals_user_kind_unique', 'goals', 'user_id'],
    ['streaks_user_day_unique', 'streaks', 'user_id'],
    ['reports_conversation_unique', 'session_reports', 'conversation_id'],
  ]

  for (const [name, table] of uniques) {
    assert.match(
      sql,
      new RegExp(`CREATE UNIQUE INDEX "${name}" ON "${table}"`),
      `missing unique index ${name}`,
    )
  }
})

test('timestamps carry a timezone', () => {
  assert.match(sql, /"created_at" timestamp with time zone DEFAULT now\(\) NOT NULL/)
  assert.doesNotMatch(sql, /timestamp\s+DEFAULT now\(\)/, 'found a timestamp without a timezone')
})

test('json columns are jsonb, not text', () => {
  for (const column of ['interests', 'strengths', 'weaknesses', 'related', 'recommendations']) {
    assert.match(sql, new RegExp(`"${column}" jsonb`), `${column} is not jsonb`)
  }
})
