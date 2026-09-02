import { NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken } from '@/lib/session'

export async function POST(request) {
  const { password } = await request.json().catch(() => ({}))
  const correctPassword = process.env.APP_PASSWORD

  if (!correctPassword) {
    return NextResponse.json({ error: 'Server not configured: APP_PASSWORD is not set' }, { status: 500 })
  }
  if (!password || password !== correctPassword) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const token = await createSessionToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })
  return res
}
