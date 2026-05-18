import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createTimesheetEntry } from '@/lib/odoo'
import { sendWorkReport } from '@/lib/email'
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

interface SubmitBody {
  date: string
  entries: TimesheetEntry[]
  pushOdoo?: boolean
  sendEmail?: boolean
  customHtml?: string
  customSubject?: string
  customTo?: string[]
  customCc?: string[]
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: SubmitBody = await request.json()
  const { date, entries, pushOdoo = true, sendEmail = true, customHtml, customSubject, customTo, customCc } = body
  if (!entries?.length) return NextResponse.json({ error: 'No entries' }, { status: 400 })
  if (!pushOdoo && !sendEmail) return NextResponse.json({ error: 'Select at least one action' }, { status: 400 })

  const [settings, account] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: session.user.id } }),
    prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'google' },
      select: { access_token: true, refresh_token: true },
    }),
  ])

  if (!settings) return NextResponse.json({ error: 'Settings not configured' }, { status: 400 })

  const results = {
    odoo: [] as number[],
    odooErrors: [] as string[],
    odooSkipped: !pushOdoo,
    emailSent: false,
    emailError: '',
    emailSkipped: !sendEmail,
  }

  if (pushOdoo) {
    const odooConfig = {
      url: settings.odooUrl,
      database: settings.odooDatabase,
      username: settings.odooUsername,
      password: settings.odooPassword,
    }
    const odooResults = await Promise.all(
      entries.map((entry) =>
        createTimesheetEntry(odooConfig, {
          projectId: entry.projectId,
          taskId: entry.taskId,
          date,
          hours: entry.hours,
          description: entry.description,
          status: entry.status,
        })
          .then((id) => ({ ok: true as const, id }))
          .catch((e: unknown) => ({ ok: false as const, msg: (e as Error).message }))
      )
    )
    for (const r of odooResults) {
      if (r.ok) results.odoo.push(r.id)
      else results.odooErrors.push(r.msg)
    }
  }

  if (sendEmail) {
    const recipients = customTo !== undefined ? customTo : parseEmailList(settings.emailRecipients)
    const cc = customCc !== undefined ? customCc : parseEmailList(settings.emailCc)
    const bcc = parseEmailList(settings.emailBcc)

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
          subjectName: settings?.displayName || undefined,
          recipients,
          cc,
          bcc,
          date,
          entries,
          signatureFields: extractSignatureFields(settings),
          customHtml,
          customSubject,
        })
        results.emailSent = true
      } catch (e: unknown) {
        results.emailError = (e as Error).message
      }
    }
  }

  await prisma.submission.create({
    data: {
      userId: session.user.id,
      date,
      entries: JSON.stringify(entries),
      emailSent: results.emailSent,
      odooSynced: results.odoo.length > 0 && results.odooErrors.length === 0,
    },
  })

  const taggedEntries = (entries as (TimesheetEntry & { __repo?: string })[]).filter(
    (e) => e.__repo && e.projectId && e.taskId
  )
  await Promise.all(
    taggedEntries.map((e) =>
      prisma.repoMapping
        .upsert({
          where: { userId_repoFullName: { userId: session.user.id, repoFullName: e.__repo! } },
          update: {
            projectId: e.projectId,
            projectName: e.projectName,
            taskId: e.taskId,
            taskName: e.taskName,
            count: { increment: 1 },
          },
          create: {
            userId: session.user.id,
            repoFullName: e.__repo!,
            projectId: e.projectId,
            projectName: e.projectName,
            taskId: e.taskId,
            taskName: e.taskName,
          },
        })
        .catch((err) => console.error('[submit] repo mapping save failed', err))
    )
  )

  return NextResponse.json(results)
}
