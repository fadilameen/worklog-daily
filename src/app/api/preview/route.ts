import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildEmailHtml, formatEmailDate } from '@/lib/email'
import { parseEmailList } from '@/lib/utils'
import { extractSignatureFields } from '@/lib/signature-template'

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

  const userName = session.user.name || session.user.email || 'User'
  const subjectName = settings?.displayName || userName

  const html = buildEmailHtml({
    userName,
    userEmail: session.user.email || '',
    date,
    entries,
    signatureFields: extractSignatureFields(settings),
  })

  const subject = `Daily Work Report_${formatEmailDate(date)}_${subjectName.toUpperCase()}`
  const to = parseEmailList(settings?.emailRecipients)
  const cc = parseEmailList(settings?.emailCc)
  const bcc = parseEmailList(settings?.emailBcc)

  return NextResponse.json({ html, subject, to, cc, bcc })
}
