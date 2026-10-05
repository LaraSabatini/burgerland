'use client'

import { useActionState } from 'react'
import { changePassword, createUser, type FormResult } from '@/app/actions/users'
import { Button, Field } from '@/components/ui'

function Message({ state }: { state: FormResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-critical">{state.error}</p>
  if (state?.ok) return <p className="text-sm text-good">✓ {state.ok}</p>
  return null
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined)
  return (
    <form action={action} className="space-y-3">
      <Field label="Usuario" name="username" autoComplete="off" required />
      <Field label="Contraseña" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Message state={state} />
      <Button type="submit" disabled={pending}>Crear usuario</Button>
    </form>
  )
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined)
  return (
    <form action={action} className="space-y-3">
      <Field label="Contraseña actual" name="current" type="password" autoComplete="current-password" required />
      <Field label="Nueva contraseña" name="next" type="password" autoComplete="new-password" minLength={8} required />
      <Message state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>Cambiar</Button>
    </form>
  )
}
