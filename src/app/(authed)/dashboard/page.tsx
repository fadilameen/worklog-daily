'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarDays, Plus, Send, Sparkles, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate, cn } from '@/lib/utils'

interface OdooRecord {
  id: number
  name: string
}

const STATUSES = ['Completed', 'Ongoing', 'On-Hold', 'On-Queue'] as const

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

interface TimesheetEntry {
  id: string
  projectId: number | null
  projectName: string
  taskId: number | null
  taskName: string
  hours: number
  description: string
  status: string
  tasks: OdooRecord[]
  loadingTasks: boolean
  loadingAI: boolean
  aiHint: string
}

function makeEntry(): TimesheetEntry {
  return {
    id: crypto.randomUUID(),
    projectId: null,
    projectName: '',
    taskId: null,
    taskName: '',
    hours: 1,
    description: '',
    status: 'Completed',
    tasks: [],
    loadingTasks: false,
    loadingAI: false,
    aiHint: '',
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [date, setDate] = useState(formatDate())
  const [projects, setProjects] = useState<OdooRecord[]>([])
  const [entries, setEntries] = useState<TimesheetEntry[]>([makeEntry()])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectsError, setProjectsError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true)
    setProjectsError('')
    try {
      const res = await fetch('/api/odoo/projects')
      if (!res.ok) {
        const err = await res.json()
        setProjectsError(err.error || 'Failed to load projects')
        return
      }
      setProjects(await res.json())
    } catch {
      setProjectsError('Network error')
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  useEffect(() => {
    if (session) loadProjects()
  }, [session, loadProjects])

  const updateEntry = (id: string, patch: Partial<TimesheetEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  const handleProjectChange = async (id: string, projectId: number) => {
    const project = projects.find((p) => p.id === projectId)
    updateEntry(id, {
      projectId,
      projectName: project?.name || '',
      taskId: null,
      taskName: '',
      tasks: [],
      loadingTasks: true,
    })
    try {
      const res = await fetch(`/api/odoo/tasks?projectId=${projectId}`)
      const tasks = res.ok ? await res.json() : []
      updateEntry(id, { tasks, loadingTasks: false })
    } catch {
      updateEntry(id, { loadingTasks: false })
    }
  }

  const handleTaskChange = (id: string, taskId: number) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        const task = e.tasks.find((t) => t.id === taskId)
        return { ...e, taskId, taskName: task?.name || '' }
      })
    )
  }

  const generateDescription = async (id: string) => {
    const entry = entries.find((e) => e.id === id)
    if (!entry || !entry.projectName || !entry.taskName) return
    updateEntry(id, { loadingAI: true })
    try {
      const res = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: entry.projectName,
          taskName: entry.taskName,
          hours: entry.hours,
          hint: entry.aiHint,
        }),
      })
      const data = await res.json()
      if (data.description) updateEntry(id, { description: data.description })
    } catch {
      toast.error('AI generation failed')
    } finally {
      updateEntry(id, { loadingAI: false })
    }
  }

  const handleSubmit = async () => {
    const valid = entries.filter(
      (e) => e.projectId && e.taskId && e.hours > 0 && e.description.trim()
    )
    if (!valid.length) {
      toast.error('Fill all fields for at least one entry')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, entries: valid }),
      })
      const data = await res.json()
      const odooMsg =
        data.odooErrors.length === 0
          ? `Odoo: ${data.odoo.length} entries`
          : `Odoo: ${data.odoo.length} ok, ${data.odooErrors.length} failed`
      const emailMsg = data.emailSent ? 'Email sent' : `Email failed: ${data.emailError}`
      if (data.odooErrors.length === 0 && data.emailSent) {
        toast.success(`${odooMsg} · ${emailMsg}`)
      } else {
        toast.error(`${odooMsg} · ${emailMsg}`)
      }
    } catch {
      toast.error('Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0)

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10 lg:py-14">
      <header className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Today</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Log work</h1>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="font-mono">{totalHours.toFixed(2)}h</span>
          </div>
        </div>
      </header>

      {projectsError && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span className="text-foreground">
            {projectsError === 'Odoo not configured' ? (
              <>
                Odoo not configured.{' '}
                <a href="/settings" className="underline underline-offset-2 text-accent">
                  Open settings
                </a>
              </>
            ) : (
              projectsError
            )}
          </span>
        </div>
      )}

      {loadingProjects && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading projects from Odoo…
        </div>
      )}

      <div className="mt-8 space-y-4">
        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className="overflow-hidden rounded-xl border border-border bg-surface/40"
          >
            <div className="flex items-center justify-between border-b border-border bg-surface/60 px-5 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Entry {String(idx + 1).padStart(2, '0')}
              </span>
              {entries.length > 1 && (
                <button
                  onClick={() => setEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Project
                  </Label>
                  <Select
                    value={entry.projectId?.toString() || ''}
                    onValueChange={(v) => handleProjectChange(entry.id, Number(v))}
                    disabled={loadingProjects}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select project…" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Task
                  </Label>
                  <Select
                    value={entry.taskId?.toString() || ''}
                    onValueChange={(v) => handleTaskChange(entry.id, Number(v))}
                    disabled={!entry.projectId || entry.loadingTasks}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          entry.loadingTasks
                            ? 'Loading tasks…'
                            : !entry.projectId
                            ? 'Select project first'
                            : 'Select task…'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {entry.tasks.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Status
                </Label>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => {
                    const active = entry.status === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateEntry(entry.id, { status: s })}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-xs font-semibold transition-all',
                          active
                            ? 'border-transparent shadow-sm'
                            : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                        )}
                        style={
                          active
                            ? { backgroundColor: STATUS_BG[s], color: STATUS_FG[s] }
                            : undefined
                        }
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Hours
                </Label>
                <Input
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  value={entry.hours}
                  onChange={(e) =>
                    updateEntry(entry.id, { hours: parseFloat(e.target.value) || 0 })
                  }
                  className="w-32 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  value={entry.description}
                  onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                  rows={3}
                  placeholder="Describe what you worked on…"
                  className="resize-none"
                />

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={entry.aiHint}
                    onChange={(e) => updateEntry(entry.id, { aiHint: e.target.value })}
                    placeholder="Hint for AI (optional)…"
                    className="flex-1 text-xs"
                  />
                  <Button
                    onClick={() => generateDescription(entry.id)}
                    disabled={!entry.projectId || !entry.taskId || entry.loadingAI}
                    size="sm"
                    className="shrink-0 gap-1.5 bg-accent text-accent-foreground hover:opacity-90"
                  >
                    {entry.loadingAI ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {entry.loadingAI ? 'Generating' : 'Generate'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between px-1">
        <Button
          variant="ghost"
          onClick={() => setEntries((prev) => [...prev, makeEntry()])}
          className="gap-1.5 text-accent hover:bg-accent/10 hover:text-accent"
        >
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
        <span className="font-mono text-sm text-muted-foreground">
          {totalHours.toFixed(2)}h total
        </span>
      </div>

      <div className="mt-8">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          size="lg"
          className="w-full gap-2 bg-accent text-accent-foreground hover:opacity-90"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting ? 'Submitting…' : 'Submit day'}
        </Button>
      </div>
    </div>
  )
}
