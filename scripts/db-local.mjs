// Base de datos Postgres local (PGlite) para probar el panel sin tocar Supabase.
//   npm run db:local            → la levanta (la crea con datos de ejemplo la primera vez)
//   npm run db:local -- --reset → la borra y la vuelve a crear
//   npm run db:local -- --vacia → crea la base sólo con el menú real, sin datos de ejemplo
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'

const PUERTO = Number(process.env.PGLITE_PORT ?? 54329)
const args = process.argv.slice(2)
const carpeta = path.resolve('.pglite')
const datos = path.join(carpeta, 'data')

if (args.includes('--reset') && fs.existsSync(carpeta)) {
  fs.rmSync(carpeta, { recursive: true, force: true })
  console.log('Base local borrada.')
}

const esNueva = !fs.existsSync(datos)
fs.mkdirSync(carpeta, { recursive: true })
const db = await PGlite.create(datos)

if (esNueva) {
  const archivos = ['schema.sql', 'seed_menu.sql']
  if (!args.includes('--vacia')) archivos.push('seed_demo.sql')
  for (const archivo of archivos) {
    const inicio = Date.now()
    await db.exec(fs.readFileSync(path.join('db', archivo), 'utf8'))
    console.log(`✓ ${archivo} (${Date.now() - inicio} ms)`)
  }
  const hash = await bcrypt.hash('lasazon2026', 10)
  await db.query(
    'insert into usuarios (email, nombre, password_hash) values ($1, $2, $3)',
    ['demo@lasazon.com', 'Demo', hash]
  )
  console.log('✓ Usuario de prueba: demo@lasazon.com / lasazon2026')
}

const server = new PGLiteSocketServer({ db, port: PUERTO, host: '127.0.0.1', maxConnections: 10 })
await server.start()
console.log(`Base local escuchando en postgresql://postgres:postgres@127.0.0.1:${PUERTO}/postgres`)

const cerrar = async () => {
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on('SIGINT', cerrar)
process.on('SIGTERM', cerrar)
