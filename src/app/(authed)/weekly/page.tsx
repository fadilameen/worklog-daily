'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarRange, Loader2, Eye, Send, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { DatePicker } from '@/components/ui/date-picker'
import { STATUSES, STATUS_BG, STATUS_FG } from '@/lib/status'
import { cn } from '@/lib/utils'

interface RawRow {
  date: string
  projectName: string
  taskName: string
  status: string
  description: string
}

interface ConciseEntry {
  projectName: string
  taskName: string
  status: string
  description: string
  perDay?: Array<{ date: string; status: string; description: string }>
}


function mondayOfToday(): string {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

type Stage = 'idle' | 'raw' | 'concise'

export default function WeeklyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [date, setDate] = useState(mondayOfToday())
  const [stage, setStage] = useState<Stage>('idle')
  const [loading, setLoading] = useState(false)
  const [conciseLoading, setConciseLoading] = useState(false)
  const [weekLabel, setWeekLabel] = useState('')
  const [monday, setMonday] = useState('')
  const [friday, setFriday] = useState('')
  const [rawRows, setRawRows] = useState<RawRow[]>([])
  const [usedDates, setUsedDates] = useState<string[]>([])
  const [entries, setEntries] = useState<ConciseEntry[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  const fetchRaw = async () => {
    setLoading(true)
    setStage('idle')
    setRawRows([])
    setEntries([])
    try {
      const res = await fetch('/api/weekly/raw', {
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
      setRawRows(data.rows)
      setUsedDates(data.usedDates || [])
      setStage('raw')
      if (data.empty) toast.error('No reports found for this week')
      else toast.success(`${data.rows.length} rows from ${(data.usedDates || []).length} day(s)`)
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const makeConcise = async () => {
    setConciseLoading(true)
    try {
      const res = await fetch('/api/weekly/concise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rawRows }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Concise failed')
        return
      }
      setEntries(data.entries)
      setStage('concise')
      toast.success(`Concised into ${data.entries.length} entries`)
    } catch {
      toast.error('Network error')
    } finally {
      setConciseLoading(false)
    }
  }

  const updateEntry = (idx: number, patch: Partial<ConciseEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)))
  }

  const openPreview = async () => {
    if (!entries.length) {
      toast.error('Concise the rows first')
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
      } else setPreviewHtml(data.html)
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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Weekly</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Weekly report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a date in the target week. Fetches daily reports Mon-Fri from Gmail.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DatePicker value={date} onChange={setDate} className="w-52" highlightWeek />
          <Button
            onClick={fetchRaw}
            disabled={loading}
            className="gap-2 bg-accent text-accent-foreground hover:opacity-90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {loading ? 'Fetching…' : 'Fetch week'}
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

      {/* Stage: raw rows */}
      {stage === 'raw' && (
        <>
          {rawRows.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center text-sm text-muted-foreground">
              No daily reports found in Gmail for {monday} → {friday}.
            </div>
          ) : (
            <>
              <div className="mt-8 overflow-hidden rounded-xl border border-border bg-surface/40">
                <div className="flex items-center justify-between border-b border-border bg-surface/60 px-5 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Raw rows from {rawRows.length} entries
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {usedDates.length} days
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-surface/40">
                      <tr className="border-b border-border">
                        <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Date</th>
                        <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Project</th>
                        <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Task</th>
                        <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                        <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.map((r, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{r.date}</td>
                          <td className="px-4 py-2.5 text-xs">{r.projectName}</td>
                          <td className="px-4 py-2.5 text-xs">{r.taskName}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span
                              className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: STATUS_BG[r.status] || 'transparent',
                                color: STATUS_FG[r.status] || 'inherit',
                              }}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  onClick={makeConcise}
                  disabled={conciseLoading}
                  size="lg"
                  className="w-full gap-2 bg-accent text-accent-foreground hover:opacity-90"
                >
                  {conciseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {conciseLoading ? 'Concising…' : 'Concise (group + AI summarize)'}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* Stage: concise grouped */}
      {stage === 'concise' && entries.length > 0 && (
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
            <DialogDescription>Sent to recipients configured in Settings.</DialogDescription>
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
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
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
