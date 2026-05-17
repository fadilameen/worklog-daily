import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await prisma.githubAuth.findUnique({ where: { userId: session.user.id } })
  if (!auth) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })

  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
    Accept: 'application/vnd.github+json',
  }

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
