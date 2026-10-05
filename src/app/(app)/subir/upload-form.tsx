'use client'

import Link from 'next/link'
import { startTransition, useActionState, useRef, useState } from 'react'
import { uploadOrders } from '@/app/actions/upload'
import { Button, Card } from '@/components/ui'
import { fmtDate, fmtMoney } from '@/lib/format'
import { fmtPhone } from '@/lib/phone'

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadOrders, undefined)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function send(f: File, intent: 'preview' | 'import', swap?: boolean) {
    const fd = new FormData()
    fd.set('file', f)
    fd.set('intent', intent)
    if (swap !== undefined) fd.set('swap', swap ? 'yes' : 'no')
    startTransition(() => action(fd))
  }

  function pick(f: File | undefined) {
    if (!f) return
    setFile(f)
    send(f, 'preview')
  }

  function reset() {
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''
    const fd = new FormData()
    fd.set('intent', 'reset')
    startTransition(() => action(fd))
  }

  const preview = state?.step === 'preview' ? state : null
  const done = state?.step === 'done' ? state : null

  return (
    <div className="space-y-6">
      {!done && (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            pick(e.dataTransfer.files[0])
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
            dragging ? 'border-accent bg-accent/5' : 'border-line bg-surface hover:border-accent/60'
          }`}
        >
          <svg aria-hidden width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="mt-3 font-medium">{file ? file.name : 'Arrastrá el Excel acá o hacé clic para elegirlo'}</span>
          <span className="mt-1 text-sm text-muted">Archivo .xlsx exportado de pedidos</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
      )}

      {pending && <p className="text-sm text-ink-2">Procesando…</p>}

      {state?.step === 'error' && (
        <div role="alert" className="rounded-lg border border-critical/30 bg-critical-wash px-4 py-3 text-sm text-critical">
          <p>{state.error}</p>
          {state.errors?.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      {preview && file && !pending && (
        <Card
          title={`Vista previa · ${preview.summary!.orders} pedidos`}
          subtitle={`Del ${fmtDate(preview.summary!.firstDate, true)} al ${fmtDate(preview.summary!.lastDate, true)} · ${fmtMoney(
            preview.summary!.revenue,
          )}${preview.summary!.cancelled ? ` · ${preview.summary!.cancelled} cancelados (no suman)` : ''}`}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-surface-2 px-4 py-3 text-sm">
            <span className="text-ink-2">
              ¿Las fechas están bien? El exportador a veces invierte día y mes
              {preview.swapReason === 'archivo' && ' (detectado con el nombre del archivo)'}.
            </span>
            <label className="ml-auto flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={!!preview.swapped}
                onChange={(e) => send(file, 'preview', e.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
              Invertir día y mes
            </label>
          </div>

          {preview.summary!.withoutPhone > 0 && (
            <div className="mb-4 rounded-lg border border-critical/30 bg-critical-wash px-4 py-3 text-sm">
              <strong>
                {preview.summary!.withoutPhone === preview.summary!.orders
                  ? 'Ningún pedido trae WhatsApp.'
                  : `${preview.summary!.withoutPhone} pedidos no traen WhatsApp.`}
              </strong>{' '}
              Se importan y cuentan para las ventas, pero no suman estrellas hasta que se cargue el número en la ficha del cliente.
            </div>
          )}

          {preview.errors && preview.errors.length > 0 && (
            <div className="mb-4 text-sm text-critical">
              <p className="font-medium">Filas que se van a saltear:</p>
              {preview.errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}

          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-medium">Pedido</th>
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium">WhatsApp</th>
                  <th className="pb-2 font-medium">Pago</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {preview.preview!.map((o) => (
                  <tr key={o.id} className={`border-t border-line ${o.cancelled ? 'text-muted line-through' : ''}`}>
                    <td className="py-1.5 pr-3">#{o.id}</td>
                    <td className="py-1.5 pr-3">{fmtDate(o.date, true)}</td>
                    <td className="py-1.5 pr-3">{o.customerName}</td>
                    <td className="py-1.5 pr-3">{o.phone ? fmtPhone(o.phone) : <span className="text-critical">falta</span>}</td>
                    <td className="py-1.5 pr-3 text-ink-2">{o.paymentMethod}</td>
                    <td className="py-1.5 text-right">{fmtMoney(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => send(file, 'import', preview.swapped)}>Importar {preview.summary!.orders} pedidos</Button>
            <Button variant="secondary" onClick={reset}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {done && !pending && (
        <Card>
          <p className="text-lg font-semibold text-good">✓ Pedidos importados</p>
          <p className="mt-1 text-sm text-ink-2">
            {done.result!.inserted} nuevos y {done.result!.updated} actualizados de <strong>{done.filename}</strong>.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
              Ver resumen
            </Link>
            <Link href="/clientes" className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium">
              Ver clientes
            </Link>
            <Button variant="secondary" onClick={reset}>
              Subir otro archivo
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
