'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { q1 } from '@/lib/db'
import { createSession, deleteSession } from '@/lib/session'

export interface LoginState {
  error?: string
}

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Completá email y contraseña.' }
  }

  try {
    const user = await q1<{ id: string; email: string; password_hash: string }>(
      'select id, email, password_hash from usuarios where email = $1',
      [email]
    )
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return { error: 'Email o contraseña incorrectos.' }
    }
    await createSession(user.id, user.email)
  } catch (err) {
    console.error('Error en login:', err)
    return { error: 'Error del servidor al iniciar sesión. Avisá al administrador.' }
  }

  redirect('/')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
