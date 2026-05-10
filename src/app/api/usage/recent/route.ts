import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface SubEntry {
  projectId?: number
  taskId?: number
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subs = await prisma.submission.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { entries: true },
  })

  const projectCount = new Map<number, number>()
  const taskCountByProject = new Map<number, Map<number, number>>()

  for (const sub of subs) {
    try {
      const items = JSON.parse(sub.entries) as SubEntry[]
      for (const it of items) {
        if (it.projectId) {
          projectCount.set(it.projectId, (projectCount.get(it.projectId) || 0) + 1)
          if (it.taskId) {
            if (!taskCountByProject.has(it.projectId)) taskCountByProject.set(it.projectId, new Map())
            const m = taskCountByProject.get(it.projectId)!
            m.set(it.taskId, (m.get(it.taskId) || 0) + 1)
          }
        }
      }
    } catch { /* skip */ }
  }

  const recentProjects = Array.from(projectCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  const recentTasksByProject: Record<string, number[]> = {}
  for (const [pid, tm] of taskCountByProject.entries()) {
    recentTasksByProject[pid.toString()] = Array.from(tm.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
  }

  return NextResponse.json({ recentProjects, recentTasksByProject })
}
