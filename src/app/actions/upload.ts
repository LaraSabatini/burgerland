'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { parseOrdersFile, type ParsedOrder } from '@/lib/parse'
import { importOrders } from '@/lib/orders'

export type UploadState =
  | {
      step: 'preview' | 'done' | 'error'
      filename?: string
      error?: string
      errors?: string[]
      swapped?: boolean
      swapReason?: string
      preview?: Pick<ParsedOrder, 'id' | 'date' | 'customerName' | 'phone' | 'total' | 'paymentMethod' | 'status' | 'cancelled'>[]
      summary?: { orders: number; revenue: number; firstDate: string; lastDate: string; cancelled: number; withoutPhone: number }
      result?: { inserted: number; updated: number }
    }
  | undefined

const MAX_BYTES = 10 * 1024 * 1024

export async function uploadOrders(_: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requireUser()
  if (formData.get('intent') === 'reset') return undefined
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { step: 'error', error: 'Elegí un archivo Excel (.xlsx)' }
  if (file.size > MAX_BYTES) return { step: 'error', error: 'El archivo supera los 10 MB' }
  if (!/\.xlsx$/i.test(file.name)) return { step: 'error', error: 'El archivo tiene que ser .xlsx' }

  const swapField = formData.get('swap')
  const forceSwap = swapField === 'yes' ? true : swapField === 'no' ? false : undefined

  let parsed
  try {
    parsed = await parseOrdersFile(await file.arrayBuffer(), file.name, forceSwap)
  } catch {
    return { step: 'error', error: 'No se pudo leer el archivo. ¿Es un Excel válido?' }
  }
  if (parsed.orders.length === 0) {
    return { step: 'error', error: 'No se encontraron pedidos en el archivo', errors: parsed.errors }
  }

  const valid = parsed.orders.filter((o) => !o.cancelled)
  const dates = parsed.orders.map((o) => o.date).sort()
  const base = {
    filename: file.name,
    errors: parsed.errors,
    swapped: parsed.swapped,
    swapReason: parsed.swapReason,
    summary: {
      orders: parsed.orders.length,
      revenue: valid.reduce((acc, o) => acc + o.total, 0),
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      cancelled: parsed.orders.length - valid.length,
      withoutPhone: parsed.orders.filter((o) => !o.phone).length,
    },
  }

  if (formData.get('intent') !== 'import') {
    return {
      step: 'preview',
      ...base,
      preview: parsed.orders.map(({ id, date, customerName, phone, total, paymentMethod, status, cancelled }) => ({
        id, date, customerName, phone, total, paymentMethod, status, cancelled,
      })),
    }
  }

  const result = await importOrders(parsed.orders, file.name, user.username)
  revalidatePath('/', 'layout')
  return { step: 'done', ...base, result }
}
