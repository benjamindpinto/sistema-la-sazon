import 'server-only'
import { Pool, PoolClient, types } from 'pg'

// numeric y bigint llegan como string por defecto: los pasamos a number.
types.setTypeParser(1700, (v: string) => parseFloat(v))
types.setTypeParser(20, (v: string) => parseInt(v, 10))
// timestamptz → string ISO (se puede pasar tal cual a componentes de cliente)
const parseTimestamptz = types.getTypeParser(1184)
types.setTypeParser(1184, (v: string) => (parseTimestamptz(v) as Date).toISOString())
// date → 'YYYY-MM-DD'
types.setTypeParser(1082, (v: string) => v)

const globalParaPool = globalThis as unknown as { _poolSazon?: Pool }

export function getPool(): Pool {
  if (!globalParaPool._poolSazon) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('Falta configurar DATABASE_URL en las variables de entorno')
    const local = /localhost|127\.0\.0\.1/.test(url)
    globalParaPool._poolSazon = new Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX ?? 3),
    })
  }
  return globalParaPool._poolSazon
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Fila = Record<string, any>

export async function q<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(sql, params)
  return res.rows as T[]
}

export async function q1<T = Fila>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params)
  return rows[0] ?? null
}

// Corre fn dentro de una transacción. Dentro de fn usar SOLO el client recibido.
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const resultado = await fn(client)
    await client.query('commit')
    return resultado
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// Mensaje de error apto para mostrar en el panel
export function mensajeError(err: unknown, porDefecto = 'No se pudo guardar. Probá de nuevo.'): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code
    if (code === '23505') return 'Ya existe un registro con ese nombre.'
    if (code === '23503') return 'No se puede: está siendo usado en otro lado.'
    if (code === 'P0001') return (err as { message?: string }).message ?? porDefecto
  }
  console.error(err)
  return porDefecto
}
