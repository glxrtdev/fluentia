#!/usr/bin/env node
/**
 * Creates .env.local with freshly generated secrets, if it does not exist yet.
 * Run once after cloning: npm run setup
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const target = resolve(root, '.env.local')
const key = () => randomBytes(32).toString('hex')

mkdirSync(resolve(root, 'data'), { recursive: true })

if (existsSync(target)) {
  const current = readFileSync(target, 'utf8')
  const missing = ['ENCRYPTION_KEY'].filter(
    (name) => !new RegExp(`^${name}=.+`, 'm').test(current),
  )
  if (missing.length === 0) {
    console.log('.env.local already configured — nothing to do.')
    process.exit(0)
  }
  writeFileSync(target, `${current.trimEnd()}\n${missing.map((n) => `${n}=${key()}`).join('\n')}\n`)
  console.log(`Added missing secrets to .env.local: ${missing.join(', ')}`)
  process.exit(0)
}

writeFileSync(
  target,
  [
    'DATABASE_URL=./data/fluentia.db',
    `ENCRYPTION_KEY=${key()}`,
    '',
  ].join('\n'),
)
console.log('Created .env.local with new secrets.')
