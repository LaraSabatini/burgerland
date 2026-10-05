import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Chequeo optimista: solo valida la firma de la cookie. La verificación
// completa contra la base la hace requireUser() en cada página/acción.
export default async function proxy(req: NextRequest) {
  // La tarjeta digital del cliente es pública (se accede con su link)
  if (req.nextUrl.pathname.startsWith('/tarjeta/')) return NextResponse.next()
  const isLogin = req.nextUrl.pathname === '/login'
  const token = req.cookies.get('session')?.value
  let valid = false
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET), {
        algorithms: ['HS256'],
      })
      valid = true
    } catch {}
  }

  if (!valid && !isLogin) return NextResponse.redirect(new URL('/login', req.nextUrl))
  if (valid && isLogin) return NextResponse.redirect(new URL('/', req.nextUrl))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)'],
}
