#!/usr/bin/env node
/**
 * Applies pending migrations to Postgres and keeps the achievement catalogue in
 * sync with the code. Runs as a single process before dev/build/start so
 * concurrent Next.js workers never race.
 */
import { resolve } from 'node:path'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { ACHIEVEMENTS } from '../src/lib/domain/achievements.ts'

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'DATABASE_URL is missing.\n' +
      'Copy the Supabase connection string (Project Settings → Database → Connection string → URI)\n' +
      'into .env.local as DATABASE_URL=...',
  )
  process.exit(1)
}

// A dedicated single connection: migrations must not share the app's pool.
const client = postgres(url, { max: 1, prepare: false, connect_timeout: 30 })

try {
  await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), 'drizzle') })

  for (const [index, achievement] of ACHIEVEMENTS.entries()) {
    await client`
      insert into achievements (id, title, description, icon, xp, sort_order)
      values (${achievement.id}, ${achievement.title}, ${achievement.description},
              ${achievement.icon}, ${achievement.xp}, ${index})
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        icon = excluded.icon,
        xp = excluded.xp,
        sort_order = excluded.sort_order
    `
  }

  const host = new URL(url.replace(/^postgres(ql)?:/, 'https:')).host
  console.log(`Database ready at ${host} · ${ACHIEVEMENTS.length} achievements in sync`)
} catch (error) {
  console.error('Migration failed:', error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
