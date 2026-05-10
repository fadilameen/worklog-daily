import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const submissions = await prisma.submission.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return NextResponse.json(
    submissions.map((s) => ({
      ...s,
      entries: JSON.parse(s.entries),
    }))
  )
}
