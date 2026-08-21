import 'server-only'

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { seedAchievements } from './seed'
import * as schema from './schema'

export type Db = ReturnType<typeof create>

function create() {
  const file = resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.DATABASE_URL ?? './data/fluentia.db',
  )

  if (!existsSync(file)) {
    throw new Error(
      `No database at ${file}. Run \`npm run db:migrate\` (dev/build/start do it for you).`,
    )
  }

  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  const db = drizzle(sqlite, { schema })
  seedAchievements(db)

  return db
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __fluentiaDb?: Db }

export const db: Db = globalForDb.__fluentiaDb ?? create()
if (process.env.NODE_ENV !== 'production') globalForDb.__fluentiaDb = db

export { schema }
