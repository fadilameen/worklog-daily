import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ connected: false })

  const auth = await prisma.githubAuth.findUnique({
    where: { userId: session.user.id },
    select: { username: true },
  })

  return NextResponse.json({ connected: !!auth, username: auth?.username || null })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.githubAuth.deleteMany({ where: { userId: session.user.id } })
  return NextResponse.json({ ok: true })
}
