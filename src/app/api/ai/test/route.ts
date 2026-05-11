import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { aiComplete } from '@/lib/ai'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt, aiProvider, openrouterApiKey, openrouterModel, geminiApiKey, geminiModel } = await request.json()
  if (!prompt?.trim()) return NextResponse.json({ error: 'No prompt' }, { status: 400 })

  try {
    const text = await aiComplete(prompt.trim(), {
      provider: aiProvider || 'openrouter',
      openrouterApiKey: openrouterApiKey || undefined,
      openrouterModel: openrouterModel || undefined,
      geminiApiKey: geminiApiKey || undefined,
      geminiModel: geminiModel || undefined,
    }, 'ai/test')
    return NextResponse.json({ response: text })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
