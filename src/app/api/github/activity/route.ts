import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGithubContext, GithubCommit, MERGE_RE } from '@/lib/github'
import { istDayUtcRange } from '@/lib/utils'

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

  const ctx = await getGithubContext(session.user.id)
  if (!ctx) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
  const { auth, headers } = ctx

  const { startUtc, endUtc } = istDayUtcRange(date)

  type RawCommit = { repository: { full_name: string }; commit: { message: string }; sha: string; parents?: unknown[] }
  const [commitRes, issueRes] = await Promise.all([
    fetch(`https://api.github.com/search/commits?q=author:${auth.username}+author-date:${startUtc}..${endUtc}&per_page=30`, {
      headers: { ...headers, Accept: 'application/vnd.github.cloak-preview+json' },
    }),
    fetch(`https://api.github.com/search/issues?q=author:${auth.username}+created:${startUtc}..${endUtc}&per_page=30`, { headers }),
  ])
  const [commitData, issueData] = await Promise.all([commitRes.json(), issueRes.json()])

  const commits: GithubCommit[] = (commitData.items || [])
    .filter((c: RawCommit) => !Array.isArray(c.parents) || c.parents.length <= 1)
    .filter((c: RawCommit) => !MERGE_RE.test(c.commit.message.split('\n')[0]))
    .map((c: RawCommit) => ({
      repo: c.repository.full_name,
      message: c.commit.message.split('\n')[0],
      sha: c.sha.slice(0, 7),
    }))

  const issues: IssueItem[] = (issueData.items || []).map((i: { pull_request?: unknown; repository_url: string; number: number; title: string; state: string }) => ({
    type: i.pull_request ? 'pr' : 'issue',
    repo: i.repository_url.replace('https://api.github.com/repos/', ''),
    number: i.number,
    title: i.title,
    state: i.state,
  }))

  return NextResponse.json({ username: auth.username, since: startUtc, until: endUtc, commits, issues })
}
