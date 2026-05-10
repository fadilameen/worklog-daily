import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTimesheetEntry } from '@/lib/odoo'
import { sendWorkReport } from '@/lib/email'

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

  const [settings, account] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: session.user.id } }),
    prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'google' },
      select: { access_token: true, refresh_token: true },
    }),
  ])

  if (!settings) return NextResponse.json({ error: 'Settings not configured' }, { status: 400 })

  const odooConfig = {
    url: settings.odooUrl,
    database: settings.odooDatabase,
    username: settings.odooUsername,
    password: settings.odooPassword,
  }

  const results = { odoo: [] as number[], odooErrors: [] as string[], emailSent: false, emailError: '' }

  // Push to Odoo
  for (const entry of entries) {
    try {
      const id = await createTimesheetEntry(odooConfig, {
        projectId: entry.projectId,
        taskId: entry.taskId,
        date,
        hours: entry.hours,
        description: entry.description,
      })
      results.odoo.push(id)
    } catch (e: unknown) {
      results.odooErrors.push((e as Error).message)
    }
  }

  // Send email via Gmail API using user's OAuth token
  const recipients = settings.emailRecipients
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)

  const cc = settings.emailCc?.split(',').map((r) => r.trim()).filter(Boolean) ?? []
  const bcc = settings.emailBcc?.split(',').map((r) => r.trim()).filter(Boolean) ?? []

  if (recipients.length === 0) {
    results.emailError = 'No recipients configured'
  } else if (!account?.access_token) {
    results.emailError = 'No Google access token — sign out and sign in again'
  } else {
    try {
      await sendWorkReport({
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        userEmail: session.user.email!,
        userName: session.user.name || session.user.email || 'User',
        recipients,
        cc,
        bcc,
        date,
        entries,
      })
      results.emailSent = true
    } catch (e: unknown) {
      results.emailError = (e as Error).message
    }
  }

  // Save submission record
  await prisma.submission.create({
    data: {
      userId: session.user.id,
      date,
      entries: JSON.stringify(entries),
      emailSent: results.emailSent,
      odooSynced: results.odoo.length > 0 && results.odooErrors.length === 0,
    },
  })

  return NextResponse.json(results)
}
