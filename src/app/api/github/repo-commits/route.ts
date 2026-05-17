import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { istDayUtcRange } from '@/lib/utils'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const repo = url.searchParams.get('repo')
  const date = url.searchParams.get('date')
  if (!repo) return NextResponse.json({ error: 'repo required' }, { status: 400 })

  const auth = await prisma.githubAuth.findUnique({ where: { userId: session.user.id } })
  if (!auth) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })

  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
    Accept: 'application/vnd.github+json',
  }

  let commitsUrl: string
  let dateFiltered = false

  if (date) {
    const { startUtc, endUtc } = istDayUtcRange(date)
    commitsUrl = `https://api.github.com/repos/${repo}/commits?since=${startUtc}&until=${endUtc}&per_page=100`
    dateFiltered = true
  } else {
    commitsUrl = `https://api.github.com/repos/${repo}/commits?per_page=30`
  }

  const res = await fetch(commitsUrl, { headers })
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch commits' }, { status: 502 })

  const data = await res.json()
  if (!Array.isArray(data)) return NextResponse.json({ commits: [], dateFiltered })

  type RawCommit = {
    sha: string
    commit: { message: string; author?: { name?: string; date?: string } }
  }

  function mapCommit(c: RawCommit) {
    return {
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0].trim(),
      author: c.commit.author?.name || '',
      date: c.commit.author?.date || null,
    }
  }

  // If date-filtered and empty, fall back to recent commits
  if (dateFiltered && data.length === 0) {
    const recentRes = await fetch(
      `https://api.github.com/repos/${repo}/commits?per_page=30`,
      { headers }
    )
    if (recentRes.ok) {
      const recent = await recentRes.json()
      if (Array.isArray(recent) && recent.length > 0) {
        return NextResponse.json({
          commits: recent.map(mapCommit),
          dateFiltered: false,
        })
      }
    }
    return NextResponse.json({ commits: [], dateFiltered: true })
  }

  return NextResponse.json({
    commits: data.map(mapCommit),
    dateFiltered,
  })
}
