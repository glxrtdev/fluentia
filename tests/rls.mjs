/**
 * The public Data API stays shut.
 *
 * Supabase serves the `public` schema over PostgREST to a role called `anon`,
 * reachable by anyone holding the project's anon key — a credential designed to
 * sit in browsers. For a while every table here was readable, writable and
 * deletable through it: e-mails and password hashes, the encrypted provider
 * keys, and `sessions`, where inserting one row is enough to walk in as any
 * account. Supabase's own scanner is what caught it.
 *
 * Fluentia never uses that API — it connects straight to Postgres as the owner
 * of these tables, and an owner bypasses row-level security. So RLS is enabled
 * with no policies at all: the API sees nothing, the app notices nothing.
 *
 * This asserts both halves, because either alone can rot. A table added later
 * without RLS would reopen the hole silently, which is exactly how it happened
 * the first time.
 */
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

let failures = 0
const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

async function main() {
  const tables = await sql`
    select c.relname as table,
           c.relrowsecurity as rls,
           pg_get_userbyid(c.relowner) as owner,
           has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
           has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
           has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
           has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname`

  record('there are tables to check at all', tables.length > 0, `${tables.length} found`)

  const unprotected = tables.filter((t) => !t.rls)
  record(
    'every table in the public schema has row-level security on',
    unprotected.length === 0,
    unprotected.length ? unprotected.map((t) => t.table).join(', ') : `all ${tables.length}`,
  )

  const granted = tables.filter(
    (t) => t.anon_select || t.anon_insert || t.anon_delete || t.auth_select,
  )
  record(
    'and the public roles hold no privileges on them',
    granted.length === 0,
    granted.length ? granted.map((t) => t.table).join(', ') : 'none granted',
  )

  /*
   * The app must be unaffected, and this is the half worth proving rather than
   * assuming: RLS that also locked out Fluentia would be a worse outage than
   * the exposure it fixes.
   */
  const owned = tables.filter((t) => t.owner === 'postgres')
  record(
    'the app connects as the tables’ owner, which bypasses RLS',
    owned.length === tables.length,
    `${owned.length}/${tables.length} owned by postgres`,
  )

  const [{ count }] = await sql`select count(*)::int as count from users`
  record('and it can still read', typeof count === 'number', `${count} users`)

  const probe = '00000000-0000-4000-8000-00000000beef'
  await sql`delete from users where id = ${probe}`
  await sql`insert into users (id, email, name, password_hash)
            values (${probe}, 'rls-check@fluentia.test', 'Probe', 'x')`
  const [back] = await sql`select email from users where id = ${probe}`
  record('and still write', back?.email === 'rls-check@fluentia.test')
  await sql`delete from users where id = ${probe}`

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sql`delete from users where email like '%@fluentia.test'`
    await sql.end()
  })
