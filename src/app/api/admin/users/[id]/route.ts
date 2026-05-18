import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { adminGuard } from '@/lib/admin'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminGuard()
  if (!guard.ok) return guard.response
  const { id } = await params
  if (id === guard.adminId) return NextResponse.json({ error: 'Cannot delete self' }, { status: 400 })
  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Delete failed' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await adminGuard()
  if (!guard.ok) return guard.response
  const { id } = await params
  if (id === guard.adminId) return NextResponse.json({ error: 'Cannot act on self' }, { status: 400 })
  const { suspended } = await req.json()
  if (typeof suspended !== 'boolean') return NextResponse.json({ error: 'suspended (boolean) required' }, { status: 400 })
  try {
    if (suspended) {
      await prisma.$transaction([
        prisma.user.update({ where: { id }, data: { suspended: true } }),
        prisma.session.deleteMany({ where: { userId: id } }),
      ])
    } else {
      await prisma.user.update({ where: { id }, data: { suspended: false } })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Update failed' }, { status: 500 })
  }
}
