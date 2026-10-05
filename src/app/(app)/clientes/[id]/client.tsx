'use client'

import { useActionState, useState } from 'react'
import { updatePhone } from '@/app/actions/customers'
import { Button } from '@/components/ui'
import { fmtPhone } from '@/lib/phone'

export function PhoneForm({ id, phone }: { id: number; phone: string | null }) {
  const [state, action, pending] = useActionState(updatePhone, undefined)
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-sm font-medium text-ink-2">WhatsApp</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={phone ? fmtPhone(phone) : ''}
          placeholder="11 2345 6789"
          className="h-10 w-full rounded-lg border border-line bg-page px-3 text-sm outline-none focus:border-accent"
        />
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>
        Guardar
      </Button>
      {state?.error && <p className="w-full text-xs text-critical">{state.error}</p>}
      {state?.ok && <p className="w-full text-xs text-good">✓ {state.ok}</p>}
    </form>
  )
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? '✓ Copiado' : label}
    </Button>
  )
}
