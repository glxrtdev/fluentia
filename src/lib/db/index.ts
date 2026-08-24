import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

type Client = ReturnType<typeof create>

function create() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is missing. Set the Supabase connection string in .env.local (local) ' +
        'or in the deployment environment variables.',
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
const globalForDb = globalThis as unknown as { __fluentiaDb?: Client }

function connection(): Client {
  globalForDb.__fluentiaDb ??= create()
  return globalForDb.__fluentiaDb
}

/**
 * The database handle, connected on first use rather than on import.
 *
 * A build machine analyses this module without any credentials — connecting
 * eagerly would fail the build instead of the request that actually needs a
 * database.
 */
export const db = new Proxy({} as Client, {
  get: (_target, property, receiver) => Reflect.get(connection(), property, receiver),
  has: (_target, property) => Reflect.has(connection(), property),
})

export { schema }
