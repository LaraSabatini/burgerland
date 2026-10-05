import { requireUser } from '@/lib/dal'
import { getUploads } from '@/lib/orders'
import { fmtDate } from '@/lib/format'
import { Card, PageHeader } from '@/components/ui'
import { UploadForm } from './upload-form'

export const metadata = { title: 'Subir pedidos · Burgerland' }

export default async function UploadPage() {
  await requireUser()
  const uploads = await getUploads()
  return (
    <>
      <PageHeader
        title="Subir pedidos"
        subtitle="Subí el Excel exportado. Si un pedido ya estaba cargado, se actualiza en vez de duplicarse."
      />
      <UploadForm />
      {uploads.length > 0 && (
        <Card title="Últimas cargas" className="mt-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-medium">Archivo</th>
                  <th className="pb-2 font-medium">Usuario</th>
                  <th className="pb-2 text-right font-medium">Nuevos</th>
                  <th className="pb-2 text-right font-medium">Actualizados</th>
                  <th className="pb-2 text-right font-medium">Fecha (UTC)</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {uploads.map((u) => (
                  <tr key={u.id} className="border-t border-line">
                    <td className="max-w-xs truncate py-2 pr-4">{u.filename}</td>
                    <td className="py-2 pr-4 text-ink-2">{u.username}</td>
                    <td className="py-2 text-right">{u.inserted}</td>
                    <td className="py-2 text-right">{u.updated}</td>
                    <td className="py-2 text-right text-ink-2">{fmtDate(u.createdAt.slice(0, 16), true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
