import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { odooLogin } from '@/lib/odoo'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url, database, username, password } = await request.json()

  try {
    const uid = await odooLogin({ url, database, username, password })
    return NextResponse.json({ success: true, uid })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
