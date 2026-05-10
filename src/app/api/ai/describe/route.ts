import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { buildStyleBlock, istDayUtcRange } from '@/lib/utils'

interface CommitItem { repo: string; message: string }
interface IssueItem { type: 'pr' | 'issue'; repo: string; number: number; title: string }

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectName, taskName, hint, hours, date, useGithub } = await request.json()

  // Lookup user's global writing style
  let styleBlock = ''
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { descriptionStyle: true },
    })
    styleBlock = buildStyleBlock(settings?.descriptionStyle)
  } catch { /* skip */ }

  let githubBlock = ''
  if (useGithub && date) {
    try {
      const auth = await prisma.githubAuth.findUnique({ where: { userId: session.user.id } })
      if (auth) {
        console.log('[ai/describe] github user:', auth.username, '| date:', date)
        const headers = { Authorization: `Bearer ${auth.accessToken}`, Accept: 'application/vnd.github+json' }

        const { startUtc: aStart, endUtc: aEnd } = istDayUtcRange(date)
        const commitUrl = `https://api.github.com/search/commits?q=author:${auth.username}+author-date:${aStart}..${aEnd}&per_page=20`
        console.log('[ai/describe] COMMIT REQUEST:', commitUrl)
        const commitRes = await fetch(commitUrl, {
          headers: { ...headers, Accept: 'application/vnd.github.cloak-preview+json' },
        })
        const commitData = await commitRes.json()
        console.log('[ai/describe] COMMIT STATUS:', commitRes.status)
        console.log('[ai/describe] COMMIT RAW RESPONSE:', JSON.stringify(commitData, null, 2))
        const commits: CommitItem[] = (commitData.items || []).map((c: { repository: { full_name: string }; commit: { message: string } }) => ({
          repo: c.repository.full_name,
          message: c.commit.message.split('\n')[0],
        }))

        const issueUrl = `https://api.github.com/search/issues?q=author:${auth.username}+created:${aStart}..${aEnd}&per_page=20`
        console.log('[ai/describe] ISSUE REQUEST:', issueUrl)
        const issueRes = await fetch(issueUrl, { headers })
        const issueData = await issueRes.json()
        console.log('[ai/describe] ISSUE STATUS:', issueRes.status)
        console.log('[ai/describe] ISSUE RAW RESPONSE:', JSON.stringify(issueData, null, 2))
        const issues: IssueItem[] = (issueData.items || []).map((i: { pull_request?: unknown; repository_url: string; number: number; title: string }) => ({
          type: i.pull_request ? 'pr' : 'issue',
          repo: i.repository_url.replace('https://api.github.com/repos/', ''),
          number: i.number,
          title: i.title,
        }))

        const lines: string[] = []
        if (commits.length) {
          lines.push('Commits:')
          commits.forEach(c => lines.push(`  - [${c.repo}] ${c.message}`))
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

  console.log('[ai/describe] INPUT:', JSON.stringify({ projectName, taskName, hours, hint, date, useGithub, hasStyle: !!styleBlock }))

  const prompt = `Summarize the functional outcomes as a polished changelog paragraph.

- Project: ${projectName}
- Task: ${taskName}
- Hours spent: ${hours}
${hint ? `- User notes: ${hint}` : ''}${githubBlock}${styleBlock}

Hard rules:
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
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    console.log('[ai/describe] STATUS:', res.status, '| RAW:', JSON.stringify(data, null, 2))
    if (!res.ok) throw new Error(data.error?.message || 'OpenRouter error')
    const msg = data.choices?.[0]?.message
    const text = (msg?.content || msg?.reasoning || '').trim()
    if (!text) throw new Error('Empty response from model')
    console.log('[ai/describe] OUTPUT TEXT:\n' + text + '\n--- END OUTPUT ---')
    return NextResponse.json({ description: text })
  } catch (e: unknown) {
    console.error('[ai/describe] ERROR:', (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
