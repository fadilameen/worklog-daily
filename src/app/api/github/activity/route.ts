import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

  // Day window in UTC (rough but ok)
  const since = `${date}T00:00:00Z`
  const until = `${date}T23:59:59Z`

  console.log('[github/activity] user:', auth.username, '| date:', date)

  // Search commits authored by user on date
  const commitQ = `author:${auth.username}+author-date:${date}`
  const commitUrl = `https://api.github.com/search/commits?q=${commitQ}&per_page=30`
  console.log('[github/activity] COMMIT REQUEST:', commitUrl)
  const commitRes = await fetch(commitUrl, {
    headers: { ...headers, Accept: 'application/vnd.github.cloak-preview+json' },
  })
  const commitData = await commitRes.json()
  console.log('[github/activity] COMMIT STATUS:', commitRes.status)
  console.log('[github/activity] COMMIT RAW RESPONSE:', JSON.stringify(commitData, null, 2))
  const commits: CommitItem[] = (commitData.items || []).map((c: { repository: { full_name: string }; commit: { message: string }; sha: string }) => ({
    repo: c.repository.full_name,
    message: c.commit.message.split('\n')[0],
    sha: c.sha.slice(0, 7),
  }))

  // PRs/issues by user on date
  const issueQ = `author:${auth.username}+created:${date}`
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
