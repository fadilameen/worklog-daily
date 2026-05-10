import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface SubEntry {
  projectId?: number
  projectName: string
  taskId?: number
  taskName: string
  hours: number
  description: string
  status?: string
}

interface GroupedEntry {
  projectId?: number
  projectName: string
  taskId?: number
  taskName: string
  status: string
  description: string
  perDay: Array<{ date: string; status: string; description: string }>
}

function isoWeekLabel(monday: Date): string {
  // ISO week number: Thursday in same week determines year
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

function fridayOf(monday: string): string {
  const d = new Date(monday + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 4)
  return d.toISOString().split('T')[0]
}

async function aiSummarize(prompt: string): Promise<string> {
  console.log('[weekly/preview] PROMPT:\n' + prompt + '\n--- END PROMPT ---')
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b:free',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    console.log('[weekly/preview] STATUS:', res.status, '| RAW:', JSON.stringify(data, null, 2))
    const msg = data.choices?.[0]?.message
    return ((msg?.content || msg?.reasoning || '') as string).trim()
  } catch (e) {
    console.error('[weekly/preview] AI ERROR:', (e as Error).message)
    return ''
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date }: { date: string } = await request.json()
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const monday = mondayOf(date)
  const friday = fridayOf(monday)
  const mondayDate = new Date(monday + 'T00:00:00Z')
  const weekLabel = isoWeekLabel(mondayDate)

  // Fetch submissions in date range Mon..Fri
  const subs = await prisma.submission.findMany({
    where: {
      userId: session.user.id,
      date: { gte: monday, lte: friday },
    },
    orderBy: { date: 'asc' },
  })

  if (subs.length === 0) {
    return NextResponse.json({
      weekLabel,
      monday,
      friday,
      entries: [],
      empty: true,
    })
  }

  // Group entries by (projectId, taskId)
  const groups = new Map<string, GroupedEntry>()
  for (const sub of subs) {
    let items: SubEntry[] = []
    try {
      items = JSON.parse(sub.entries) as SubEntry[]
    } catch { continue }
    for (const it of items) {
      const key = `${it.projectId ?? it.projectName}::${it.taskId ?? it.taskName}`
      if (!groups.has(key)) {
        groups.set(key, {
          projectId: it.projectId,
          projectName: it.projectName,
          taskId: it.taskId,
          taskName: it.taskName,
          status: it.status || 'Ongoing',
          description: '',
          perDay: [],
        })
      }
      const g = groups.get(key)!
      g.perDay.push({ date: sub.date, status: it.status || 'Ongoing', description: it.description })
      g.status = it.status || 'Ongoing' // last sub wins since iterating asc
    }
  }

  // Get user style
  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { descriptionStyle: true },
  })
  const styleExample = settings?.descriptionStyle?.trim() || ''

  // AI-summarize per group
  const styleBlock = styleExample
    ? `\n\nMATCH THIS EXAMPLE'S STYLE EXACTLY:\n"""\n${styleExample}\n"""`
    : ''

  const grouped = Array.from(groups.values())
  const summarized = await Promise.all(
    grouped.map(async (g) => {
      if (g.perDay.length === 1) {
        return { ...g, description: g.perDay[0].description }
      }
      const daily = g.perDay
        .map((d) => `- [${d.date}, ${d.status}] ${d.description}`)
        .join('\n')
      const prompt = `Combine multiple daily work log entries for the same task into a single weekly summary paragraph.

Project: ${g.projectName}
Task: ${g.taskName}
Final status: ${g.status}

Daily entries this week:
${daily}${styleBlock}

Rules:
- Functional overview, not narrative. Describe WHAT was improved/fixed/built across the week.
- BANNED: "I", "me", "we", "our", "today", "spent the day", "this week".
- BANNED: backticks, file paths, function names, API routes.
- Start with a past-tense action verb: "Cleaned up", "Refined", "Strengthened", "Polished".
- Long comma-spliced sentences. Parenthetical asides for the WHY.
- "Also fixed…" / "Also polished…" to chain.
- Output ONLY the description paragraph(s). No preamble.`
      const summary = await aiSummarize(prompt)
      return { ...g, description: summary || g.perDay.map((d) => d.description).join(' ') }
    })
  )

  return NextResponse.json({
    weekLabel,
    monday,
    friday,
    entries: summarized,
    empty: false,
  })
}
