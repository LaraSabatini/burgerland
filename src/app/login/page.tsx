import { LoginForm } from './login-form'

export const metadata = { title: 'Ingresar · Burgerland' }

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Ingresar</h1>
        <p className="mt-1 text-sm text-ink-2">Accedé con tu usuario y contraseña.</p>
        <LoginForm />
      </div>
    </main>
  )
}
