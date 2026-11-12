// Crea un usuario del panel o le cambia la contraseña si ya existe.
//   node --env-file=.env.local scripts/crear-usuario.mjs email@dominio.com "contraseña" "Nombre"
import pg from 'pg'
import bcrypt from 'bcryptjs'

const [email, password, nombre] = process.argv.slice(2)
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL')
if (!email || !password) throw new Error('Uso: crear-usuario.mjs <email> <contraseña> [nombre]')
if (password.length < 6) throw new Error('La contraseña tiene que tener al menos 6 caracteres')

const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false } })
await client.connect()
const hash = await bcrypt.hash(password, 10)
const { rows } = await client.query(
  `insert into usuarios (email, nombre, password_hash) values (lower($1), $2, $3)
   on conflict (email) do update set password_hash = excluded.password_hash, nombre = coalesce(excluded.nombre, usuarios.nombre)
   returning (xmax = 0) as creado`,
  [email.trim(), nombre ?? null, hash]
)
console.log(rows[0].creado ? `✓ Usuario ${email} creado` : `✓ Contraseña de ${email} actualizada`)
await client.end()
