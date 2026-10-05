'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { Field, Button } from '@/components/ui'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Usuario" name="username" autoComplete="username" defaultValue={state?.username} required autoFocus />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required />
      {state?.error && (
        <p role="alert" className="text-sm text-critical">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  )
}
