'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, FileText, Loader2, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDisplayDate } from '@/lib/utils'
import { PREFILL_STORAGE_KEY, type PrefillEntry } from '@/lib/prefill-entry'

interface Entry {
  projectId?: number
  projectName: string
  taskId?: number
  taskName: string
  hours: number
  description: string
  status?: string
}

interface Submission {
  id: string
  date: string
  entries: Entry[]
  emailSent: boolean
  odooSynced: boolean
  createdAt: string
}

export default function HistoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  useEffect(() => {
    if (!session) return
    fetch('/api/history')
      .then((r) => r.json())
      .then(setSubmissions)
      .finally(() => setLoading(false))
  }, [session])

  const duplicate = (e: Entry) => {
    if (!e.projectId || !e.taskId) return
    const payload: PrefillEntry = {
      projectId: e.projectId,
      projectName: e.projectName,
      taskId: e.taskId,
      taskName: e.taskName,
      hours: e.hours,
      description: e.description,
      status: e.status,
    }
    sessionStorage.setItem(PREFILL_STORAGE_KEY, JSON.stringify(payload))
    router.push('/dashboard')
  }

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">History</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Past submissions</h1>
        <p className="mt-2 text-sm text-muted-foreground">All your daily work reports.</p>
      </header>

      {submissions.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nothing submitted yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Log work from the{' '}
            <a href="/dashboard" className="text-accent underline underline-offset-2">
              dashboard
            </a>{' '}
            to see history here.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {submissions.map((s) => {
            const total = s.entries.reduce((sum, e) => sum + e.hours, 0)
            return (
              <div
                key={s.id}
                className="overflow-hidden rounded-xl border border-border bg-surface/40"
              >
                <div className="flex items-center justify-between border-b border-border bg-surface/60 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">{formatDisplayDate(s.date)}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {total.toFixed(2)}h · {s.entries.length} {s.entries.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge ok={s.odooSynced} label="Odoo" />
                    <StatusBadge ok={s.emailSent} label="Email" />
                  </div>
                </div>

                <ul className="divide-y divide-border">
                  {s.entries.map((e, i) => (
                    <li key={i} className="flex items-start gap-4 px-5 py-3">
                      <span className="mt-0.5 w-6 font-mono text-xs text-muted-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{e.projectName}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-sm text-muted-foreground">{e.taskName}</span>
                          {e.status && (
                            <Badge variant="outline" className="font-mono text-[10px] uppercase">
                              {e.status}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {e.description}
                        </p>
                      </div>
                      <span className="font-mono text-sm text-foreground shrink-0">
                        {e.hours}h
                      </span>
                      <button
                        onClick={() => duplicate(e)}
                        disabled={!e.projectId || !e.taskId}
                        title="Duplicate to dashboard"
                        className="rounded-md border border-border bg-surface px-2 py-1 text-muted-foreground transition hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
      <CheckCircle2 className="h-3 w-3" /> {label}
    </span>
  ) : (
    <span className="flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-destructive">
      <XCircle className="h-3 w-3" /> {label}
    </span>
  )
}
