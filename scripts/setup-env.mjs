#!/usr/bin/env node
/**
 * Creates .env.local with a freshly generated encryption key, if it does not
 * exist yet. The database URL still has to be pasted in by hand — it is a
 * credential, so nothing here invents one.
 *
 * Run once after cloning: npm run setup
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const target = resolve(root, '.env.local')
const key = () => randomBytes(32).toString('hex')

if (existsSync(target)) {
  const current = readFileSync(target, 'utf8')
  const missing = ['ENCRYPTION_KEY'].filter((name) => !new RegExp(`^${name}=.+`, 'm').test(current))

  if (missing.length > 0) {
    writeFileSync(target, `${current.trimEnd()}\n${missing.map((n) => `${n}=${key()}`).join('\n')}\n`)
    console.log(`Added missing secrets to .env.local: ${missing.join(', ')}`)
  } else {
    console.log('.env.local already configured — nothing to do.')
  }

  if (!/^DATABASE_URL=.+/m.test(current)) {
    console.warn(
      '\nDATABASE_URL is still empty in .env.local.\n' +
        'Paste your Supabase connection string there:\n' +
        '  Supabase dashboard → Project Settings → Database → Connection string → URI',
    )
  }
  process.exit(0)
}

writeFileSync(
  target,
  [
    '# Supabase: Project Settings -> Database -> Connection string -> URI',
    'DATABASE_URL=',
    '',
    '# Encrypts each user OpenAI key at rest. Rotating it invalidates every stored key.',
    `ENCRYPTION_KEY=${key()}`,
    '',
  ].join('\n'),
)

console.log(
  'Created .env.local with a new ENCRYPTION_KEY.\n' +
    'Now paste your Supabase connection string into DATABASE_URL.',
)
