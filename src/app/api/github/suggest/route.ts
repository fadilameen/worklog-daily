import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getGithubContext, fetchCommitsAllBranches, GithubCommit, MERGE_RE } from '@/lib/github'
import { istDayUtcRange, utcInstantToIstDate, parseEmailList } from '@/lib/utils'

interface SuggestedEntry {
  repo: string
  commitCount: number
  hours: number
  projectId: number | null
  projectName: string
  taskId: number | null
  taskName: string
  description: string
  commits: string[]
  isPersonal: boolean
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const ctx = await getGithubContext(session.user.id)
  if (!ctx) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
  const { auth, headers } = ctx

  const { startUtc, endUtc } = istDayUtcRange(date)
  const searchUrl = `https://api.github.com/search/commits?q=author:${auth.username}+author-date:${startUtc}..${endUtc}&per_page=100`

  const [searchRes, eventsRes, userEventsRes] = await Promise.all([
    fetch(searchUrl, { headers: { ...headers, Accept: 'application/vnd.github.cloak-preview+json' } }),
    fetch(`https://api.github.com/users/${auth.username}/events?per_page=100`, { headers }),
    fetch(`https://api.github.com/user/events?per_page=100`, { headers }),
  ])

  const searchData = searchRes.ok ? await searchRes.json() : { items: [] }
  const eventsData = eventsRes.ok ? await eventsRes.json() : []
  const userEventsData = userEventsRes.ok ? await userEventsRes.json() : []
  console.log('[github/suggest] SEARCH STATUS:', searchRes.status, '| total:', searchData.total_count || 0)
  console.log('[github/suggest] PUBLIC EVENTS:', eventsRes.status, '| count:', Array.isArray(eventsData) ? eventsData.length : 0)
  console.log('[github/suggest] USER EVENTS:', userEventsRes.status, '| count:', Array.isArray(userEventsData) ? userEventsData.length : 0)
  const allEvents: unknown[] = []
  if (Array.isArray(eventsData)) allEvents.push(...eventsData)
  if (Array.isArray(userEventsData)) allEvents.push(...userEventsData)

  const userLogin = auth.username.toLowerCase()
  const userName = (auth.name || '').toLowerCase()
  const userEmails = parseEmailList(auth.emails).map((e) => e.toLowerCase())

  const byRepo = new Map<string, GithubCommit[]>()
  const seenSha = new Set<string>()

  function dedupAdd(repo: string, sha: string, message: string) {
    if (seenSha.has(sha)) return
    const subject = message.split('\n')[0].trim()
    if (MERGE_RE.test(subject)) return
    seenSha.add(sha)
    if (!byRepo.has(repo)) byRepo.set(repo, [])
    byRepo.get(repo)!.push({ repo, message: message.trim(), sha: sha.slice(0, 7) })
  }

  // parents.length > 1 catches merge commits the subject regex alone misses
  for (const c of (searchData.items || []) as Array<{ repository: { full_name: string }; commit: { message: string }; sha: string; parents?: unknown[] }>) {
    if (Array.isArray(c.parents) && c.parents.length > 1) continue
    dedupAdd(c.repository.full_name, c.sha, c.commit.message)
  }

  // Process events on the date — capture repos from any event type
  interface PushPayload { commits?: Array<{ sha: string; message: string; author?: { name?: string; email?: string } }> }
  interface CreatePayload { ref_type?: string; description?: string }
  interface PRPayload { action?: string; pull_request?: { title?: string; number?: number } }
  interface IssuesPayload { action?: string; issue?: { title?: string; number?: number } }
  interface Event {
    type: string
    created_at: string
    repo: { name: string }
    payload: PushPayload & CreatePayload & PRPayload & IssuesPayload
  }
  const seenEventKey = new Set<string>()
  for (const evRaw of allEvents) {
    const ev = evRaw as Event
    if (utcInstantToIstDate(ev.created_at) !== date) continue
    const dedupKey = `${ev.type}:${ev.repo.name}:${ev.created_at}`
    if (seenEventKey.has(dedupKey)) continue
    seenEventKey.add(dedupKey)

    const repo = ev.repo.name
    if (!byRepo.has(repo)) byRepo.set(repo, [])

    if (ev.type === 'PushEvent') {
      const cs = ev.payload?.commits || []
      for (const c of cs) {
        if (seenSha.has(c.sha)) continue
        const authorName = (c.author?.name || '').toLowerCase()
        const authorEmail = (c.author?.email || '').toLowerCase()
        const isUserAuthored =
          // Exact email match
          userEmails.includes(authorEmail) ||
          // Name match (full or partial)
          (userName && (authorName === userName || authorName.includes(userName))) ||
          // Login-based fallback
          authorName === userLogin ||
          authorEmail.startsWith(userLogin + '@') ||
          authorEmail.includes(`+${userLogin}@`) // GitHub noreply pattern
        if (!isUserAuthored) continue
        dedupAdd(repo, c.sha, c.message)
      }
    } else if (ev.type === 'CreateEvent') {
      const what = ev.payload?.ref_type === 'repository' ? 'Created repository' : `Created ${ev.payload?.ref_type}`
      byRepo.get(repo)!.push({ repo, message: what, sha: 'create' })
    } else if (ev.type === 'PullRequestEvent') {
      const pr = ev.payload?.pull_request
      byRepo.get(repo)!.push({
        repo,
        message: `PR #${pr?.number}: ${pr?.title || ''} (${ev.payload?.action})`,
        sha: `pr-${pr?.number}`,
      })
    } else if (ev.type === 'IssuesEvent') {
      const iss = ev.payload?.issue
      byRepo.get(repo)!.push({
        repo,
        message: `Issue #${iss?.number}: ${iss?.title || ''} (${ev.payload?.action})`,
        sha: `iss-${iss?.number}`,
      })
    }
  }

  const isRealCommit = (i: GithubCommit) =>
    i.sha !== 'create' && !i.sha.startsWith('pr-') && !i.sha.startsWith('iss-')

  for (const [repo, items] of Array.from(byRepo.entries())) {
    if (!items.some(isRealCommit)) byRepo.delete(repo)
  }

  // events only show last 300 events; search only indexes default branch
  const reposWithCommits = Array.from(byRepo.keys())
  await Promise.all(
    reposWithCommits.map(async (repo) => {
      const branchCommits = await fetchCommitsAllBranches(repo, auth.username, startUtc, endUtc, ctx.headers)
      for (const c of branchCommits) dedupAdd(repo, c.sha, c.message)
    })
  )
  console.log('[github/suggest] after all-branch supplement:', Array.from(byRepo.values()).reduce((s, a) => s + a.length, 0), 'total commits')

  if (byRepo.size === 0) return NextResponse.json({ suggestions: [] })

  const repoNames = Array.from(byRepo.keys())
  const mappings = await prisma.repoMapping.findMany({
    where: { userId: session.user.id, repoFullName: { in: repoNames } },
  })
  const mapByRepo = new Map(mappings.map((m) => [m.repoFullName, m]))

  const suggestions: SuggestedEntry[] = Array.from(byRepo.entries()).map(([repo, items]) => {
    const m = mapByRepo.get(repo)
    const realCommits = items.filter(isRealCommit)
    return {
      repo,
      commitCount: items.length,
      hours: 8,
      projectId: m?.projectId ?? null,
      projectName: m?.projectName ?? '',
      taskId: m?.taskId ?? null,
      taskName: m?.taskName ?? '',
      description: realCommits
        .map((c) => `- ${c.message.split('\n').map((l, i) => i === 0 ? l : `  ${l}`).join('\n')}`)
        .join('\n\n'),
      commits: realCommits.map((c) => c.message),
      isPersonal: false,
    }
  })

  suggestions.sort((a, b) => {
    const am = a.projectId !== null
    const bm = b.projectId !== null
    if (am !== bm) return am ? -1 : 1
    return b.commitCount - a.commitCount
  })

  return NextResponse.json({ suggestions })
}
