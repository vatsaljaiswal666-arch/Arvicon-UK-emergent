import { NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

// Runs on every request except Next.js's own static/image assets.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login'])

export async function middleware(req) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const valid = await verifySessionToken(token)
  if (valid) return NextResponse.next()

  // API calls get a plain 401 instead of a redirect (no HTML to redirect to)
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}
