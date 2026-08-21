import { sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { ACHIEVEMENTS } from '@/lib/domain/achievements'

import { achievements } from './schema'
import type * as schema from './schema'

const excluded = (column: string) => sql.raw(`excluded."${column}"`)

/** Keeps the achievement catalogue in the database in sync with the code. */
export function seedAchievements(db: BetterSQLite3Database<typeof schema>) {
  db.insert(achievements)
    .values(
      ACHIEVEMENTS.map((a, index) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        icon: a.icon,
        xp: a.xp,
        sortOrder: index,
      })),
    )
    .onConflictDoUpdate({
      target: achievements.id,
      set: {
        title: excluded('title'),
        description: excluded('description'),
        icon: excluded('icon'),
        xp: excluded('xp'),
        sortOrder: excluded('sort_order'),
      },
    })
    .run()
}
