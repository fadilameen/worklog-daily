import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGithubContext } from '@/lib/github'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getGithubContext(session.user.id)
  if (!ctx) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
  const { headers } = ctx

  const res = await fetch(
    'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
    { headers }
  )
  if (!res.ok) return NextResponse.json({ error: 'GitHub API error' }, { status: 502 })

  const data = await res.json()
  if (!Array.isArray(data)) return NextResponse.json([])

  return NextResponse.json(
    data.map((r: { full_name: string; description: string | null; private: boolean; updated_at: string }) => ({
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      updatedAt: r.updated_at,
    }))
  )
}
