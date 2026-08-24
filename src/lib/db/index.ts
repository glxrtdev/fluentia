import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

export type Db = ReturnType<typeof create>

function create() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is missing. Copy the Supabase connection string into .env.local.',
    )
  }

  const client = postgres(url, {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    /*
     * A page fans out ~10 queries at once. With a smaller pool they queue in
     * waves, and every wave costs a full round trip to the database's region.
     * The transaction pooler multiplexes, so holding more client connections
     * is cheap. Lower it via DATABASE_POOL_SIZE on very constrained hosts.
     */
    max: Number(process.env.DATABASE_POOL_SIZE ?? 12),
    idle_timeout: 30,
    connect_timeout: 15,
  })

  return drizzle(client, { schema })
}

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __fluentiaDb?: Db }

export const db: Db = globalForDb.__fluentiaDb ?? create()
if (process.env.NODE_ENV !== 'production') globalForDb.__fluentiaDb = db

export { schema }
