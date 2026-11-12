// Aplica uno o más archivos .sql contra la base de DATABASE_URL (por ejemplo, Supabase).
//   node --env-file=.env.local scripts/aplicar-sql.mjs db/schema.sql db/seed_menu.sql
import pg from 'pg'
import fs from 'node:fs'

const archivos = process.argv.slice(2)
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL')
if (archivos.length === 0) throw new Error('Indicá qué archivos .sql aplicar')

const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false } })
await client.connect()
try {
  for (const archivo of archivos) {
    await client.query('begin')
    await client.query(fs.readFileSync(archivo, 'utf8'))
    await client.query('commit')
    console.log(`✓ ${archivo}`)
  }
} catch (err) {
  await client.query('rollback').catch(() => {})
  console.error('✗ Error, no se aplicó el último archivo:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
