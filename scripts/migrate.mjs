#!/usr/bin/env node
/**
 * Applies pending migrations to Postgres and keeps the achievement catalogue in
 * sync with the code. Runs as a single process so concurrent Next.js workers
 * never race.
 *
 * Deliberately plain JavaScript with no TypeScript imports: build machines run
 * Node 22, which cannot load `.ts` files.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const root = resolve(import.meta.dirname, '..')
const achievements = JSON.parse(
  readFileSync(resolve(root, 'src/lib/domain/achievements.json'), 'utf8'),
)

const url = process.env.DATABASE_URL
if (!url) {
  console.error(
    'DATABASE_URL is missing.\n' +
      'Local: paste the Supabase connection string into .env.local.\n' +
      'Hosted: set it in the project environment variables.',
  )
  process.exit(1)
}

// A dedicated single connection: migrations must not share the app's pool.
const client = postgres(url, {
  max: 1,
  prepare: false,
  connect_timeout: 30,
  // Re-running an applied migration emits "already exists, skipping" notices.
  // They are not errors, and they read like failures in a CI log.
  onnotice: () => {},
})

try {
  await migrate(drizzle(client), { migrationsFolder: resolve(root, 'drizzle') })

  for (const [index, achievement] of achievements.entries()) {
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
  console.log(`Database ready at ${host} · ${achievements.length} achievements in sync`)
} catch (error) {
  console.error('Migration failed:', error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
