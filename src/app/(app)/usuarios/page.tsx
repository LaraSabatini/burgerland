import { requireUser } from '@/lib/dal'
import { db } from '@/lib/db'
import { deleteUser } from '@/app/actions/users'
import { Card, PageHeader } from '@/components/ui'
import { ChangePasswordForm, CreateUserForm } from './forms'

export const metadata = { title: 'Usuarios · Burgerland' }

export default async function UsersPage() {
  const me = await requireUser()
  const client = await db()
  const { rows } = await client.execute('SELECT id, username, created_at FROM users ORDER BY username')

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Quiénes pueden entrar a la app." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Usuarios" className="lg:col-span-2">
          <ul className="divide-y divide-line">
            {rows.map((u) => (
              <li key={Number(u.id)} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  {String(u.username)}
                  {Number(u.id) === me.id && <span className="ml-2 text-xs text-muted">(vos)</span>}
                </span>
                {Number(u.id) !== me.id && (
                  <form action={deleteUser}>
                    <input type="hidden" name="id" value={Number(u.id)} />
                    <button className="rounded-md px-2 py-1 text-xs text-critical hover:bg-critical-wash">Eliminar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card title="Nuevo usuario">
            <CreateUserForm />
          </Card>
          <Card title="Cambiar mi contraseña">
            <ChangePasswordForm />
          </Card>
        </div>
      </div>
    </>
  )
}
