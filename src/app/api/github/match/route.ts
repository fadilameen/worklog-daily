import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildStyleBlock } from '@/lib/utils'

interface CommitItem {
  message: string
  sha: string
}

async function aiPick(prompt: string, label: string): Promise<string> {
  console.log(`[github/match][${label}] PROMPT:\n` + prompt + '\n--- END PROMPT ---')
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
    console.log(`[github/match][${label}] STATUS:`, res.status, '| RAW:', JSON.stringify(data, null, 2))
    const msg = data.choices?.[0]?.message
    const text = ((msg?.content || msg?.reasoning || '') as string).trim()
    console.log(`[github/match][${label}] OUTPUT:\n${text}\n--- END OUTPUT ---`)
    return text
  } catch (e) {
    console.error(`[github/match][${label}] ERROR:`, (e as Error).message)
    return ''
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { repo, date, hours } = await request.json()
  if (!repo || !date) return NextResponse.json({ error: 'repo and date required' }, { status: 400 })

  const auth = await prisma.githubAuth.findUnique({ where: { userId: session.user.id } })
  if (!auth) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })

  // Fetch commits for the repo on date
  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
    Accept: 'application/vnd.github.cloak-preview+json',
  }
  const commitUrl = `https://api.github.com/search/commits?q=author:${auth.username}+author-date:${date}+repo:${repo}&per_page=50`
  console.log('[github/match] COMMIT REQUEST:', commitUrl)
  const res = await fetch(commitUrl, { headers })
  const data = await res.json()
  console.log('[github/match] COMMIT STATUS:', res.status, '| total:', data.total_count)
  if (!res.ok) return NextResponse.json({ error: data.message || 'GitHub error' }, { status: 500 })

  type RawCommit = { commit: { message: string }; sha: string; parents?: unknown[] }
  const commits: CommitItem[] = (data.items || [])
    .filter((c: RawCommit) => !Array.isArray(c.parents) || c.parents.length <= 1)
    .filter((c: RawCommit) => !/^Merge (pull request|branch|remote-tracking branch|commit) /i.test(c.commit.message.split('\n')[0]))
    .map((c: RawCommit) => ({ message: c.commit.message, sha: c.sha.slice(0, 7) }))

  const commitsText = commits
    .map((c) => `Commit ${c.sha}:\n${c.message.trim()}`)
    .join('\n\n---\n\n')

  // Saved mapping?
  const mapping = await prisma.repoMapping.findUnique({
    where: { userId_repoFullName: { userId: session.user.id, repoFullName: repo } },
  })

  // Project/task: only from saved mapping, no AI matching
  const projectId: number | null = mapping?.projectId ?? null
  const projectName = mapping?.projectName ?? ''
  const taskId: number | null = mapping?.taskId ?? null
  const taskName = mapping?.taskName ?? ''
  const isPersonal = false

  const styleBlock = buildStyleBlock(settings?.descriptionStyle)

  // Generate professional description from commits
  const descPrompt = `Summarize the functional outcomes of the day's work as a polished changelog paragraph.

Repo: ${repo}
Hours: ${hours || 'unspecified'}
Commits:
${commitsText}${styleBlock}

Hard rules:
- Functional overview, not a narrative. Describe WHAT was improved, fixed, polished, cleaned up — NOT who did it or how their day went.
- BANNED: "I", "me", "my", "we", "our", "today", "spent the day", "worked on", "in this update", "this PR".
- BANNED: backticks, file paths, function names (e.g. \`localTimeOfDay\`), API routes, env vars.
- Start with a past-tense action verb: "Cleaned up", "Refined", "Fixed", "Reworked", "Strengthened", "Polished".
- Group related fixes into long sentences with commas and "and". Use parenthetical asides for the WHY.
- Use "Also fixed…" / "Also polished…" to chain follow-up sentences.
- Reference UI labels in straight quotes ("Total"), not backticks.
- Output ONLY the description paragraph(s). No preamble like "Here is…". No bullets.`
  const description = (await aiPick(descPrompt, 'description-from-commits')).trim() || commitsText

  return NextResponse.json({
    repo,
    commitCount: commits.length,
    projectId,
    projectName,
    taskId,
    taskName,
    isPersonal,
    description,
  })
}
