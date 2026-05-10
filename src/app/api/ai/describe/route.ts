import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectName, taskName, hint, hours } = await request.json()

  const prompt = `Write a concise professional work log description (2-4 sentences) for:
- Project: ${projectName}
- Task: ${taskName}
- Hours spent: ${hours}
${hint ? `- User notes: ${hint}` : ''}

Write in first person past tense. Be specific and professional. No bullet points.`

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'google/gemini-flash-1.5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'OpenRouter error')
    const text = data.choices?.[0]?.message?.content || ''
    return NextResponse.json({ description: text.trim() })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
