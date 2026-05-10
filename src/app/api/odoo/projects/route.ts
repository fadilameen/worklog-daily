import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getProjects } from '@/lib/odoo'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
  if (!settings?.odooUrl || !settings?.odooUsername || !settings?.odooPassword) {
    return NextResponse.json({ error: 'Odoo not configured' }, { status: 400 })
  }

  try {
    const projects = await getProjects({
      url: settings.odooUrl,
      database: settings.odooDatabase,
      username: settings.odooUsername,
      password: settings.odooPassword,
    })
    return NextResponse.json(projects)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
