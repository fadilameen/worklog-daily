import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildStyleBlock, istDayUtcRange } from '@/lib/utils'
import { aiComplete, aiConfigFromSettings, type AiConfig } from '@/lib/ai'
import { fetchCommitsAllBranches } from '@/lib/github'

async function aiPick(prompt: string, label: string, config: AiConfig): Promise<string> {
  console.log(`[github/match][${label}] PROMPT:\n` + prompt + '\n--- END PROMPT ---')
  try {
    const text = await aiComplete(prompt, config, `github/match/${label}`)
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

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { descriptionStyle: true, aiProvider: true, openrouterApiKey: true, openrouterModel: true, geminiApiKey: true, geminiModel: true },
  })
  const aiConfig = aiConfigFromSettings(settings ?? null)

  const { startUtc, endUtc } = istDayUtcRange(date)
  console.log('[github/match] fetching all branches for repo:', repo, '| date:', date)
  const commits = await fetchCommitsAllBranches(repo, auth.username, startUtc, endUtc, auth.accessToken)
  console.log('[github/match] commits found across all branches:', commits.length)

  const commitsText = commits
    .map((c) => `Commit ${c.sha.slice(0, 7)}:\n${c.message.trim()}`)
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
  const description = (await aiPick(descPrompt, 'description-from-commits', aiConfig)).trim() || commitsText

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
