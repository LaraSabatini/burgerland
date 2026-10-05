import { requireUser } from '@/lib/dal'
import { logout } from '@/app/actions/auth'
import { Nav } from '@/components/nav'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">Burgerland</span>
          <Nav />
          <form action={logout} className="ml-auto flex items-center gap-3 text-sm text-ink-2">
            <span className="hidden sm:inline">{user.username}</span>
            <button className="rounded-md px-2 py-1 hover:bg-surface-2 hover:text-ink">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
