import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildEmailHtml } from '@/lib/email'

interface TimesheetEntry {
  projectId: number
  projectName: string
  taskId: number
  taskName: string
  hours: number
  description: string
  status?: string
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, entries }: { date: string; entries: TimesheetEntry[] } = await request.json()
  if (!entries?.length) return NextResponse.json({ error: 'No entries' }, { status: 400 })

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })

  const html = buildEmailHtml({
    userName: settings?.displayName || session.user.name || session.user.email || 'User',
    userEmail: session.user.email || '',
    date,
    entries,
    signature: settings?.emailSignature || '',
  })

  return NextResponse.json({ html })
}
