import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from '@/lib/session'

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (!session?.userId) {
    redirect('/login')
  }

  return { isAuth: true, userId: session.userId, email: session.email }
})

// Para Route Handlers: no redirige, devuelve null si no hay sesión.
export async function getSession() {
  const cookie = (await cookies()).get('session')?.value
  return decrypt(cookie)
}
