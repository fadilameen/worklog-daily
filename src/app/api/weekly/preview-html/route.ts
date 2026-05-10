import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildWeeklyEmailHtml } from '@/lib/email'

interface WeeklyEntry {
  projectName: string
  taskName: string
  status: string
  description: string
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { weekLabel, entries }: { weekLabel: string; entries: WeeklyEntry[] } = await request.json()
  if (!weekLabel || !entries?.length) return NextResponse.json({ error: 'Bad input' }, { status: 400 })

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })

  const html = buildWeeklyEmailHtml({
    userName: session.user.name || session.user.email || 'User',
    userEmail: session.user.email || '',
    weekLabel,
    entries,
    signature: settings?.emailSignature || '',
  })

  return NextResponse.json({ html })
}
