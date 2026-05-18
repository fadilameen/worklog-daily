import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { adminGuard } from '@/lib/admin'

export async function GET() {
  const guard = await adminGuard()
  if (!guard.ok) return guard.response

  const [users, totalSubmissions, submissionsThisWeek, recentSubmissions, repoMappingCount] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        suspended: true,
        githubAuth: { select: { username: true } },
        submissions: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { submissions: true, repoMappings: true } },
      },
      orderBy: { email: 'asc' },
    }),
    prisma.submission.count(),
    prisma.submission.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.submission.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        date: true,
        emailSent: true,
        odooSynced: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.repoMapping.count(),
  ])

  const enrichedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    suspended: u.suspended,
    githubAuth: u.githubAuth,
    _count: u._count,
    lastActiveAt: u.submissions[0]?.createdAt?.toISOString() ?? null,
  }))

  return NextResponse.json({
    users: enrichedUsers,
    totalSubmissions,
    submissionsThisWeek,
    recentSubmissions,
    repoMappingCount,
  })
}
