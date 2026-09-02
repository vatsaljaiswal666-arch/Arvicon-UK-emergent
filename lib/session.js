// Lightweight signed-cookie session for a single shared team password.
// No database/session store needed: the cookie itself carries an
// expiry timestamp plus an HMAC signature (using AUTH_SECRET) proving
// it was issued by this server and hasn't been tampered with or expired.
// Uses Web Crypto (crypto.subtle) so it works in both the Edge middleware
// runtime and the Node.js API route runtime.

export const SESSION_COOKIE = 'arvicon_session'
const SESSION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function toBase64Url(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(data, secret) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return toBase64Url(new Uint8Array(sig))
}

export async function createSessionToken() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('Missing AUTH_SECRET env var')
  const exp = Date.now() + SESSION_MS
  const sig = await hmac(String(exp), secret)
  return `${exp}.${sig}`
}

export async function verifySessionToken(token) {
  const secret = process.env.AUTH_SECRET
  if (!secret || !token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig) return false
  if (Date.now() > Number(exp)) return false
  const expected = await hmac(exp, secret)
  return expected === sig
}
