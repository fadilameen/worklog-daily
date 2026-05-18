import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS || 'fadil@cybrosys.info')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function adminGuard():
  Promise<{ ok: true; adminId: string } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!isAdmin(session.user.email)) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ok: true, adminId: session.user.id }
}
