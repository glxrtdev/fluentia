#!/usr/bin/env node
/**
 * Sets a new password for an account, straight against the database.
 *
 * There is no email delivery in Fluentia, so this is the recovery path for a
 * locked-out account — including the very first one you create.
 *
 *   npm run set-password -- you@example.com
 *
 * Plain JavaScript with no TypeScript imports: build and CI machines run Node
 * 22, which cannot load `.ts` files. The scrypt scheme below must stay in step
 * with `src/lib/crypto.ts`.
 */
import { randomBytes, scryptSync } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { Writable } from 'node:stream'

import postgres from 'postgres'

const SCRYPT_KEYLEN = 64
const SCRYPT_COST = { N: 16384, r: 8, p: 1 }

const hashPassword = (password) => {
  const salt = randomBytes(16)
  const hash = scryptSync(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, SCRYPT_COST)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('Usage: npm run set-password -- you@example.com')
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Run through npm so .env.local is loaded.')
  process.exit(1)
}

/**
 * Reads a line without echoing it, so the password never hits the scrollback.
 * readline echoes whatever it receives, so the prompt is written directly and
 * readline's own output is muted while the answer is typed.
 */
async function askHidden(question) {
  const muted = new Writable({
    write(chunk, encoding, callback) {
      if (!muted.silent) stdout.write(chunk, encoding)
      callback()
    },
  })

  const rl = createInterface({ input: stdin, output: muted, terminal: true })
  stdout.write(question)
  muted.silent = true

  try {
    return await rl.question('')
  } finally {
    muted.silent = false
    rl.close()
    stdout.write('\n')
  }
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

try {
  const [user] = await sql`select id, name from users where email = ${email} limit 1`
  if (!user) {
    console.error(`No account with the email ${email}.`)
    process.exitCode = 1
  } else {
    const password = await askHidden(`New password for ${user.name} <${email}>: `)

    if (password.length < 8) {
      console.error('Password must be at least 8 characters.')
      process.exitCode = 1
    } else {
      await sql`update users set password_hash = ${hashPassword(password)} where id = ${user.id}`
      // Any other machine holding a session should not keep it after a reset.
      await sql`delete from sessions where user_id = ${user.id}`
      console.log(`Password updated. Existing sessions were signed out.`)
    }
  }
} catch (error) {
  console.error('Failed:', error.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
