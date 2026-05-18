import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildStyleBlock, istDayUtcRange, utcInstantToIstDate } from '@/lib/utils'
import { aiComplete, aiConfigFromSettings } from '@/lib/ai'
import { getGithubContext, fetchCommitsAllBranches } from '@/lib/github'

interface IssueItem { type: 'pr' | 'issue'; repo: string; number: number; title: string }

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectName, taskName, hint, hours, date, useGithub, wordCount } = await request.json()

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { descriptionStyle: true, aiProvider: true, openrouterApiKey: true, openrouterModel: true, geminiApiKey: true, geminiModel: true },
  }).catch(() => null)
  const styleBlock = buildStyleBlock(settings?.descriptionStyle)
  const aiConfig = aiConfigFromSettings(settings ?? null)

  let githubBlock = ''
  if (useGithub && date) {
    try {
      const ctx = await getGithubContext(session.user.id)
      if (ctx) {
        const { auth, headers } = ctx
        console.log('[ai/describe] github user:', auth.username, '| date:', date)
        const { startUtc: aStart, endUtc: aEnd } = istDayUtcRange(date)

        const [eventsRes, issueRes] = await Promise.all([
          fetch(`https://api.github.com/user/events?per_page=100`, { headers }),
          fetch(`https://api.github.com/search/issues?q=author:${auth.username}+created:${aStart}..${aEnd}&per_page=20`, { headers }),
        ])
        const [eventsData, issueData] = await Promise.all([
          eventsRes.ok ? eventsRes.json() : [],
          issueRes.ok ? issueRes.json() : { items: [] },
        ])

        const reposFromEvents = new Set<string>()
        if (Array.isArray(eventsData)) {
          for (const ev of eventsData as Array<{ type: string; created_at: string; repo: { name: string } }>) {
            if (utcInstantToIstDate(ev.created_at) === date && ev.type === 'PushEvent') {
              reposFromEvents.add(ev.repo.name)
            }
          }
        }

        const allCommits = (
          await Promise.all(
            Array.from(reposFromEvents).map((repo) =>
              fetchCommitsAllBranches(repo, auth.username, aStart, aEnd, headers)
            )
          )
        ).flat()

        const issues: IssueItem[] = (issueData.items || []).map((i: { pull_request?: unknown; repository_url: string; number: number; title: string }) => ({
          type: (i.pull_request ? 'pr' : 'issue') as 'pr' | 'issue',
          repo: i.repository_url.replace('https://api.github.com/repos/', ''),
          number: i.number,
          title: i.title,
        }))

        const lines: string[] = []
        if (allCommits.length) {
          lines.push('Commits:')
          allCommits.forEach(c => lines.push(`  - [${c.repo}] ${c.message.split('\n')[0]}`))
        }
        if (issues.length) {
          lines.push('PRs/Issues:')
          issues.forEach(i => lines.push(`  - [${i.repo}] ${i.type.toUpperCase()} #${i.number}: ${i.title}`))
        }
        if (lines.length) githubBlock = `\n\nGitHub activity on ${date}:\n${lines.join('\n')}`
      }
    } catch {
      // ignore — fallback to no github context
    }
  }

  const targetWords = typeof wordCount === 'number' && wordCount > 0 ? wordCount : null

  console.log('[ai/describe] INPUT:', JSON.stringify({ projectName, taskName, hours, hint, date, useGithub, hasStyle: !!styleBlock, targetWords }))

  const prompt = `Summarize the functional outcomes as a polished changelog paragraph.

- Project: ${projectName}
- Task: ${taskName}
- Hours spent: ${hours}
${hint ? `- User notes: ${hint}` : ''}${githubBlock}${styleBlock}

Hard rules:
${targetWords ? `- Write approximately ${targetWords} words. Stay close to this count — do not go far over or under.\n` : ''}- Use plain, simple, and clear language. Every sentence must be easy to understand at a glance.
- Functional overview, not a narrative. Describe WHAT was improved/fixed/polished — NOT who did it or how their day went.
- BANNED: "I", "me", "my", "we", "our", "today", "spent the day", "worked on", "in this update", "this PR".
- BANNED: backticks, file paths, function names, API routes, env vars.
- Start with a past-tense action verb: "Cleaned up", "Refined", "Fixed", "Reworked", "Strengthened", "Polished".
- Group related fixes into long sentences with commas and "and". Parenthetical asides for the WHY.
- "Also fixed…" / "Also polished…" to chain follow-up sentences.
- UI labels in straight quotes ("Total"), not backticks.
- Output ONLY the description paragraph(s). No preamble. No bullets.`

  console.log('[ai/describe] PROMPT:\n' + prompt + '\n--- END PROMPT ---')

  try {
    const text = await aiComplete(prompt, aiConfig, 'ai/describe')
    console.log('[ai/describe] OUTPUT TEXT:\n' + text + '\n--- END OUTPUT ---')
    return NextResponse.json({ description: text })
  } catch (e: unknown) {
    console.error('[ai/describe] ERROR:', (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
