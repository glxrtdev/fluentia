#!/usr/bin/env node
/**
 * Applies pending SQL migrations. Runs as a single process before dev/build/start
 * so concurrent Next.js workers never race to create the same tables.
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

const file = resolve(process.cwd(), process.env.DATABASE_URL ?? './data/fluentia.db')
mkdirSync(dirname(file), { recursive: true })

const sqlite = new Database(file)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

migrate(drizzle(sqlite), { migrationsFolder: resolve(process.cwd(), 'drizzle') })
sqlite.close()

console.log(`Database ready at ${file}`)
