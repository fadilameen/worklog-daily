import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { istDayUtcRange } from '@/lib/utils'

interface CommitItem {
  repo: string
  message: string
  sha: string
}

interface IssueItem {
  type: 'pr' | 'issue'
  repo: string
  number: number
  title: string
  state: string
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const date = url.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const auth = await prisma.githubAuth.findUnique({ where: { userId: session.user.id } })
  if (!auth) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })

  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
    Accept: 'application/vnd.github+json',
  }

  const { startUtc, endUtc } = istDayUtcRange(date)
  const since = startUtc
  const until = endUtc

  console.log('[github/activity] user:', auth.username, '| date:', date, '| utc range:', startUtc, '..', endUtc)

  const commitQ = `author:${auth.username}+author-date:${startUtc}..${endUtc}`
  const commitUrl = `https://api.github.com/search/commits?q=${commitQ}&per_page=30`
  console.log('[github/activity] COMMIT REQUEST:', commitUrl)
  const commitRes = await fetch(commitUrl, {
    headers: { ...headers, Accept: 'application/vnd.github.cloak-preview+json' },
  })
  const commitData = await commitRes.json()
  console.log('[github/activity] COMMIT STATUS:', commitRes.status)
  console.log('[github/activity] COMMIT RAW RESPONSE:', JSON.stringify(commitData, null, 2))
  type RawCommit = { repository: { full_name: string }; commit: { message: string }; sha: string; parents?: unknown[] }
  const commits: CommitItem[] = (commitData.items || [])
    .filter((c: RawCommit) => !Array.isArray(c.parents) || c.parents.length <= 1)
    .filter((c: RawCommit) => !/^Merge (pull request|branch|remote-tracking branch|commit) /i.test(c.commit.message.split('\n')[0]))
    .map((c: RawCommit) => ({
      repo: c.repository.full_name,
      message: c.commit.message.split('\n')[0],
      sha: c.sha.slice(0, 7),
    }))

  const issueQ = `author:${auth.username}+created:${startUtc}..${endUtc}`
  const issueUrl = `https://api.github.com/search/issues?q=${issueQ}&per_page=30`
  console.log('[github/activity] ISSUE REQUEST:', issueUrl)
  const issueRes = await fetch(issueUrl, { headers })
  const issueData = await issueRes.json()
  console.log('[github/activity] ISSUE STATUS:', issueRes.status)
  console.log('[github/activity] ISSUE RAW RESPONSE:', JSON.stringify(issueData, null, 2))
  const issues: IssueItem[] = (issueData.items || []).map((i: { pull_request?: unknown; repository_url: string; number: number; title: string; state: string }) => ({
    type: i.pull_request ? 'pr' : 'issue',
    repo: i.repository_url.replace('https://api.github.com/repos/', ''),
    number: i.number,
    title: i.title,
    state: i.state,
  }))

  return NextResponse.json({ username: auth.username, since, until, commits, issues })
}
