import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'

test('migration applies and enforces per-user isolation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fluentia-'))
  const db = new Database(join(dir, 'test.db'))
  db.pragma('foreign_keys = ON')
  const folder = resolve('drizzle')
  for (const f of readdirSync(folder).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(join(folder, f), 'utf8').split('--> statement-breakpoint')) {
      db.exec(stmt)
    }
  }
  const tables = db.prepare("select name from sqlite_master where type='table'").all().map((r) => r.name)
  assert.ok(tables.includes('users'))
  assert.ok(tables.includes('conversations'))
  assert.equal(tables.length >= 16, true)

  db.prepare('insert into users (id,email,name,password_hash) values (?,?,?,?)').run('u1','a@a.com','A','h')
  assert.throws(() =>
    db.prepare('insert into users (id,email,name,password_hash) values (?,?,?,?)').run('u2','a@a.com','B','h'),
  )
  assert.throws(() =>
    db.prepare('insert into conversations (id,user_id,topic_label,level) values (?,?,?,?)').run('c1','ghost','x','beginner'),
  )
  db.close()
})
