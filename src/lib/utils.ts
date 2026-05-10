import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDisplayDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function parseEmailList(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function buildStyleBlock(style: string | null | undefined): string {
  const s = style?.trim()
  if (!s) return ''
  return `\n\nMATCH THIS EXAMPLE'S STYLE EXACTLY:\n"""\n${s}\n"""`
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

export function istDayUtcRange(istDate: string): { startUtc: string; endUtc: string } {
  const [y, m, d] = istDate.split('-').map(Number)
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0) - IST_OFFSET_MS
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1000
  const fmt = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z')
  return { startUtc: fmt(startMs), endUtc: fmt(endMs) }
}

export function utcInstantToIstDate(utcIso: string): string {
  const d = new Date(utcIso)
  if (isNaN(d.getTime())) return ''
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().split('T')[0]
}
