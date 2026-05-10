import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

function isoWeekLabel(monday: Date): string {
  const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `W${weekNum} ${d.getUTCFullYear()}`
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - (day - 1))
  return d.toISOString().split('T')[0]
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to refresh access token')
  return data.access_token
}

async function gmailFetch(url: string, accessToken: string, refreshToken: string | null): Promise<{ data: unknown; accessToken: string }> {
  let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 401 && refreshToken) {
    accessToken = await refreshAccessToken(refreshToken)
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  }
  if (!res.ok) throw new Error(`Gmail API ${res.status}`)
  return { data: await res.json(), accessToken }
}

function decodeBase64Url(s: string): string {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = norm.length % 4 === 0 ? norm : norm + '='.repeat(4 - (norm.length % 4))
  return Buffer.from(pad, 'base64').toString('utf-8')
}

interface GmailPart {
  mimeType: string
  body: { data?: string }
  parts?: GmailPart[]
}

function extractHtml(payload: GmailPart): string {
  if (payload.mimeType === 'text/html' && payload.body?.data) return decodeBase64Url(payload.body.data)
  if (payload.parts) for (const p of payload.parts) {
    const r = extractHtml(p)
    if (r) return r
  }
  return ''
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

interface RawRow {
  date: string
  projectName: string
  taskName: string
  status: string
  description: string
}

function parseDailyReportTable(html: string): Omit<RawRow, 'date'>[] {
  const rows: Omit<RawRow, 'date'>[] = []
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
  for (const tr of trMatches) {
    if (/colspan=/i.test(tr) || /Sl\s*No/i.test(tr)) continue
    const tds = tr.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []
    if (tds.length < 5) continue
    const projectName = stripHtml(tds[1])
    const taskName = stripHtml(tds[2])
    const status = stripHtml(tds[3])
    const description = stripHtml(tds[4])
    if (!projectName && !taskName) continue
    rows.push({ projectName, taskName, status, description })
  }
  return rows
}

interface GmailMessage {
  id: string
  internalDate?: string
  payload: GmailPart & { headers?: Array<{ name: string; value: string }> }
}

const MONTHS: Record<string, string> = {
  January: '01', Jan: '01',
  February: '02', Feb: '02',
  March: '03', Mar: '03',
  April: '04', Apr: '04',
  May: '05',
  June: '06', Jun: '06',
  July: '07', Jul: '07',
  August: '08', Aug: '08',
  September: '09', Sep: '09', Sept: '09',
  October: '10', Oct: '10',
  November: '11', Nov: '11',
  December: '12', Dec: '12',
}

function parseSubjectDate(subject: string): string {
  const m = subject.match(/Daily Work Report_(\d{1,2}) (\w+) (\d{4})/)
  if (!m) return ''
  const day = m[1].padStart(2, '0')
  const month = MONTHS[m[2]] || '01'
  return `${m[3]}-${month}-${day}`
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date }: { date: string } = await request.json()
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const monday = mondayOf(date)
  const friday = addDays(monday, 4)
  const allowedDates = new Set([0, 1, 2, 3, 4].map((n) => addDays(monday, n)))
  const weekLabel = isoWeekLabel(new Date(monday + 'T00:00:00Z'))

  const [account, settingsRow] = await Promise.all([
    prisma.account.findFirst({
      where: { userId: session.user.id, provider: 'google' },
      select: { access_token: true, refresh_token: true },
    }),
    prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { weeklyFilterTo: true },
    }),
  ])

  if (!account?.access_token) return NextResponse.json({ error: 'No Google access token — sign out and sign in again' }, { status: 400 })

  const filterTo = settingsRow?.weeklyFilterTo?.trim() || ''
  if (!filterTo) return NextResponse.json({ error: 'Set "Weekly filter — fetch reports sent to" in Settings → Recipients' }, { status: 400 })

  let accessToken = account.access_token

  const query = `subject:Daily Work Report to:${filterTo} newer_than:14d`
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`
  console.log('[weekly/raw] QUERY:', query)

  let listData: { messages?: Array<{ id: string }> } = {}
  try {
    const result = await gmailFetch(listUrl, accessToken, account.refresh_token)
    accessToken = result.accessToken
    listData = result.data as { messages?: Array<{ id: string }> }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const messageRefs = listData.messages || []
  const allRows: RawRow[] = []
  const usedDates: string[] = []

  const fetched = await Promise.all(
    messageRefs.map(async (ref) => {
      try {
        const result = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
          accessToken,
          account.refresh_token
        )
        return { ok: true as const, data: result.data as GmailMessage }
      } catch (e) {
        console.error('[weekly/raw] fetch failed', ref.id, (e as Error).message)
        return { ok: false as const }
      }
    })
  )

  for (const r of fetched) {
    if (!r.ok) continue
    const msg = r.data
    const subject = msg.payload.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value || ''
    const parsedDate = parseSubjectDate(subject)
    if (!parsedDate || !allowedDates.has(parsedDate)) continue
    const html = extractHtml(msg.payload)
    const rows = parseDailyReportTable(html)
    for (const row of rows) allRows.push({ date: parsedDate, ...row })
    if (rows.length > 0) usedDates.push(parsedDate)
  }

  allRows.sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    weekLabel,
    monday,
    friday,
    rows: allRows,
    usedDates: [...new Set(usedDates)].sort(),
    empty: allRows.length === 0,
  })
}
