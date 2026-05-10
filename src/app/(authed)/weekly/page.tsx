'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarRange, Loader2, Eye, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface WeeklyEntry {
  projectId?: number
  projectName: string
  taskId?: number
  taskName: string
  status: string
  description: string
  perDay?: Array<{ date: string; status: string; description: string }>
}

const STATUSES = ['Ongoing', 'Completed', 'On-Hold', 'On-Queue'] as const

const STATUS_BG: Record<string, string> = {
  Completed: 'rgb(106,168,79)',
  Ongoing: 'rgb(255,217,102)',
  'On-Hold': 'rgb(224,102,102)',
  'On-Queue': 'rgb(109,158,235)',
}
const STATUS_FG: Record<string, string> = {
  Completed: '#0a1f06',
  Ongoing: '#3a2a00',
  'On-Hold': '#3a0606',
  'On-Queue': '#0a1530',
}

function mondayOfToday(): string {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  return d.toISOString().split('T')[0]
}

export default function WeeklyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [date, setDate] = useState(mondayOfToday())
  const [loading, setLoading] = useState(false)
  const [weekLabel, setWeekLabel] = useState('')
  const [monday, setMonday] = useState('')
  const [friday, setFriday] = useState('')
  const [entries, setEntries] = useState<WeeklyEntry[]>([])
  const [empty, setEmpty] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  const generate = async () => {
    setLoading(true)
    setEntries([])
    setEmpty(false)
    try {
      const res = await fetch('/api/weekly/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to fetch week')
        return
      }
      setWeekLabel(data.weekLabel)
      setMonday(data.monday)
      setFriday(data.friday)
      setEntries(data.entries)
      setEmpty(!!data.empty)
      if (data.empty) toast.error('No submissions found for this week')
      else toast.success(`${data.entries.length} entries grouped for ${data.weekLabel}`)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const updateEntry = (idx: number, patch: Partial<WeeklyEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)))
  }

  const openPreview = async () => {
    if (!entries.length) {
      toast.error('Generate the week first')
      return
    }
    setLoadingPreview(true)
    setPreviewOpen(true)
    try {
      const res = await fetch('/api/weekly/preview-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekLabel, entries }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Preview failed')
        setPreviewOpen(false)
      } else {
        setPreviewHtml(data.html)
      }
    } finally {
      setLoadingPreview(false)
    }
  }

  const send = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/weekly/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekLabel, entries }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Send failed')
      else {
        toast.success('Weekly report sent')
        setPreviewOpen(false)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSending(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10 lg:py-14">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Weekly</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Weekly report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick any date in the week. Daily entries Mon–Fri get grouped per task.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
          <Button
            onClick={generate}
            disabled={loading}
            className="gap-2 bg-accent text-accent-foreground hover:opacity-90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Generating…' : 'Generate week'}
          </Button>
        </div>
      </header>

      {weekLabel && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarRange className="h-4 w-4" />
          <span className="font-mono">{weekLabel}</span>
          <span>·</span>
          <span>{monday} → {friday}</span>
        </div>
      )}

      {empty && (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center text-sm text-muted-foreground">
          No submissions found between {monday} and {friday}.
        </div>
      )}

      {entries.length > 0 && (
        <>
          <div className="mt-8 space-y-4">
            {entries.map((entry, idx) => (
              <div key={idx} className="overflow-hidden rounded-xl border border-border bg-surface/40">
                <div className="flex items-center justify-between border-b border-border bg-surface/60 px-5 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {String(idx + 1).padStart(2, '0')} · {entry.projectName} → {entry.taskName}
                  </span>
                  {entry.perDay && entry.perDay.length > 1 && (
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      Merged from {entry.perDay.length} days
                    </Badge>
                  )}
                </div>
                <div className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((s) => {
                      const active = entry.status === s
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateEntry(idx, { status: s })}
                          className={cn(
                            'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-all',
                            active
                              ? 'border-transparent shadow-sm'
                              : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                          )}
                          style={active ? { backgroundColor: STATUS_BG[s], color: STATUS_FG[s] } : undefined}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Remarks (summary)
                    </Label>
                    <Textarea
                      value={entry.description}
                      onChange={(e) => updateEntry(idx, { description: e.target.value })}
                      rows={5}
                      className="resize-y text-sm"
                    />
                  </div>
                  {entry.perDay && entry.perDay.length > 1 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-mono uppercase tracking-wider">
                        Show daily entries ({entry.perDay.length})
                      </summary>
                      <ul className="mt-2 space-y-2 border-l-2 border-border pl-3">
                        {entry.perDay.map((d, j) => (
                          <li key={j}>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {d.date} · {d.status}
                            </span>
                            <p className="mt-0.5 text-muted-foreground">{d.description}</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Button
              onClick={openPreview}
              size="lg"
              className="w-full gap-2 bg-accent text-accent-foreground hover:opacity-90"
            >
              <Eye className="h-4 w-4" />
              Preview & send
            </Button>
          </div>
        </>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Weekly email preview · {weekLabel}</DialogTitle>
            <DialogDescription>
              Sent to recipients configured in Settings.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded-md border border-border bg-white">
            {loadingPreview ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
              </div>
            ) : (
              <iframe
                title="Weekly preview"
                srcDoc={previewHtml}
                sandbox=""
                className="h-[60vh] w-full bg-white"
              />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={send}
              disabled={sending || loadingPreview}
              className="gap-2 bg-accent text-accent-foreground hover:opacity-90"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Sending…' : 'Send weekly report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
