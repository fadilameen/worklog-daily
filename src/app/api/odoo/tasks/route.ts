import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTasks } from '@/lib/odoo'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
  if (!settings?.odooUrl) return NextResponse.json({ error: 'Odoo not configured' }, { status: 400 })

  try {
    const tasks = await getTasks(
      {
        url: settings.odooUrl,
        database: settings.odooDatabase,
        username: settings.odooUsername,
        password: settings.odooPassword,
      },
      parseInt(projectId)
    )
    return NextResponse.json(tasks)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
