'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--char)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-display text-[30px] font-semibold text-[var(--ember)] tracking-tight">La Sazón</span>
          <p className="text-[13px] text-white/50 mt-1">Sistema de gestión del local</p>
        </div>

        <form action={action} className="card p-6 space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" name="email" type="email" required autoFocus autoComplete="username" className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">Contraseña</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
          </div>

          {state?.error && <p className="text-[var(--danger)] text-xs" role="alert">{state.error}</p>}

          <button type="submit" disabled={pending} className="btn btn-primary w-full mt-2">
            {pending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
