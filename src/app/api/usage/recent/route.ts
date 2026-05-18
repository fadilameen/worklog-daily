import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

interface SubEntry {
  projectId?: number
  projectName?: string
  taskId?: number
  taskName?: string
}

interface RecentTask {
  projectId: number
  projectName: string
  taskId: number
  taskName: string
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
  const taskInfo = new Map<string, RecentTask & { count: number }>()

  for (const sub of subs) {
    try {
      const items = JSON.parse(sub.entries) as SubEntry[]
      for (const it of items) {
        if (!it.projectId) continue
        projectCount.set(it.projectId, (projectCount.get(it.projectId) || 0) + 1)
        if (!it.taskId) continue
        const key = `${it.projectId}:${it.taskId}`
        const existing = taskInfo.get(key)
        if (existing) existing.count++
        else if (it.taskName && it.projectName) {
          taskInfo.set(key, {
            projectId: it.projectId,
            projectName: it.projectName,
            taskId: it.taskId,
            taskName: it.taskName,
            count: 1,
          })
        }
      }
    } catch { /* skip */ }
  }

  const recentProjects = Array.from(projectCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)

  const recentTasks: RecentTask[] = Array.from(taskInfo.values())
    .sort((a, b) => b.count - a.count)
    .map(({ count: _c, ...rest }) => rest)

  return NextResponse.json({ recentProjects, recentTasks })
}
