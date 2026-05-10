import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendWeeklyWorkReport } from '@/lib/email'
import { parseEmailList } from '@/lib/utils'

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
  if (!weekLabel) return NextResponse.json({ error: 'weekLabel required' }, { status: 400 })
  if (!entries?.length) return NextResponse.json({ error: 'No entries' }, { status: 400 })

  const [settings, account] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: session.user.id } }),
    prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'google' },
      select: { access_token: true, refresh_token: true },
    }),
  ])

  if (!settings) return NextResponse.json({ error: 'Settings not configured' }, { status: 400 })
  if (!account?.access_token) {
    return NextResponse.json({ error: 'No Google access token — sign out and sign in again' }, { status: 400 })
  }

  const recipients = parseEmailList(settings.emailRecipients)
  const cc = parseEmailList(settings.emailCc)
  const bcc = parseEmailList(settings.emailBcc)

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No recipients configured' }, { status: 400 })
  }

  try {
    await sendWeeklyWorkReport({
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      userEmail: session.user.email!,
      userName: session.user.name || session.user.email || 'User',
      subjectName: settings.displayName || undefined,
      recipients,
      cc,
      bcc,
      weekLabel,
      entries,
      signature: settings.emailSignature || '',
    })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
