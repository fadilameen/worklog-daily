import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGithubContext, mapBrowserCommit } from '@/lib/github'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const repo = url.searchParams.get('repo')
  const branch = url.searchParams.get('branch')
  if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 })

  const ctx = await getGithubContext(session.user.id)
  if (!ctx) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
  const { headers } = ctx

  const toCommits = (data: unknown) =>
    Array.isArray(data) ? data.map(mapBrowserCommit) : []

  if (branch) {
    const commits = await fetch(
      `https://api.github.com/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=100`,
      { headers }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then(toCommits)
    return NextResponse.json({ commits })
  }

  const [commits, branches] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/commits?per_page=100`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(toCommits),
    fetch(`https://api.github.com/repos/${repo}/branches?per_page=100`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { name: string }[]) => (Array.isArray(data) ? data.map((b) => b.name) : [])),
  ])

  return NextResponse.json({ commits, branches })
}
