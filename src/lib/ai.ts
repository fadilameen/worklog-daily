export interface AiConfig {
  provider: string
  openrouterApiKey?: string
  openrouterModel?: string
  geminiApiKey?: string
  geminiModel?: string
}

export async function aiComplete(prompt: string, config: AiConfig, label = 'ai'): Promise<string> {
  const provider = config.provider || 'openrouter'

  if (provider === 'gemini') {
    const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || ''
    if (!apiKey) throw new Error('Gemini API key not configured')
    const model = config.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    console.log(`[${label}] gemini model:`, model)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })
    const data = await res.json()
    console.log(`[${label}] gemini STATUS:`, res.status, '| RAW:', JSON.stringify(data, null, 2))
    if (!res.ok) throw new Error(data.error?.message || 'Gemini error')
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    if (!text) throw new Error('Empty response from Gemini')
    return text
  }

  // OpenRouter (default)
  const apiKey = config.openrouterApiKey || process.env.OPENROUTER_API_KEY || ''
  if (!apiKey) throw new Error('OpenRouter API key not configured')
  const model = config.openrouterModel || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free'
  console.log(`[${label}] openrouter model:`, model)
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  console.log(`[${label}] openrouter STATUS:`, res.status, '| RAW:', JSON.stringify(data, null, 2))
  if (!res.ok) throw new Error(data.error?.message || 'OpenRouter error')
  const msg = data.choices?.[0]?.message
  const text = ((msg?.content || msg?.reasoning || '') as string).trim()
  if (!text) throw new Error('Empty response from OpenRouter')
  return text
}

export function aiConfigFromSettings(settings: {
  aiProvider?: string | null
  openrouterApiKey?: string | null
  openrouterModel?: string | null
  geminiApiKey?: string | null
  geminiModel?: string | null
} | null): AiConfig {
  return {
    provider: settings?.aiProvider || 'openrouter',
    openrouterApiKey: settings?.openrouterApiKey || undefined,
    openrouterModel: settings?.openrouterModel || undefined,
    geminiApiKey: settings?.geminiApiKey || undefined,
    geminiModel: settings?.geminiModel || undefined,
  }
}
