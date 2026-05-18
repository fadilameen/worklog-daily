import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId: session.user.id } })
    return NextResponse.json(settings || {})
  } catch (e: unknown) {
    console.error('[settings GET]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const allowed = [
      'odooUrl', 'odooUsername', 'odooPassword', 'odooDatabase',
      'emailRecipients', 'emailCc', 'emailBcc',
      'signatureName', 'signatureDesignation', 'signatureDepartment', 'signatureCompany',
      'signatureEmail', 'signaturePhone', 'signatureWhatsapp',
      'descriptionStyle', 'weeklyFilterTo', 'displayName',
      'wordCountMode', 'wordCountShort', 'wordCountConcise', 'wordCountDetailed',
      'aiProvider', 'openrouterApiKey', 'openrouterModel', 'geminiApiKey', 'geminiModel',
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) data[key] = body[key]
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: data,
      create: { userId: session.user.id, ...data },
    })

    return NextResponse.json(settings)
  } catch (e: unknown) {
    console.error('[settings POST]', e)
    return NextResponse.json({ error: (e as Error).message || 'DB error' }, { status: 500 })
  }
}
