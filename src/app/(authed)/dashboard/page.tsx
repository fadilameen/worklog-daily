'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarDays, Plus, Send, Sparkles, Trash2, Loader2, AlertTriangle, Briefcase, Mail, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Eye } from 'lucide-react'
import { GithubIcon } from '@/components/icons'
import { STATUSES, STATUS_BG, STATUS_FG } from '@/lib/status'
import { formatDate, cn } from '@/lib/utils'

type Suggestion = {
  repo: string
  commitCount: number
  hours: number
  projectId: number | null
  projectName: string
  taskId: number | null
  taskName: string
  description: string
  isPersonal?: boolean
}

interface OdooRecord {
  id: number
  name: string
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
  __repo?: string
  __isPersonal?: boolean
  __pickedRepo?: string
  __generatingFromGh?: boolean
}

function makeEntry(): TimesheetEntry {
  return {
    id: crypto.randomUUID(),
    projectId: null,
    projectName: '',
    taskId: null,
    taskName: '',
    hours: 8,
    description: '',
    status: 'Ongoing',
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
  const [pushOdoo, setPushOdoo] = useState(true)
  const [sendEmail, setSendEmail] = useState(true)
  const [githubConnected, setGithubConnected] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsDate, setSuggestionsDate] = useState<string>('')
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [recentProjects, setRecentProjects] = useState<number[]>([])
  const [recentTasksByProject, setRecentTasksByProject] = useState<Record<string, number[]>>({})
  const [wordCountMode, setWordCountMode] = useState<'short' | 'concise' | 'detailed' | 'none'>('concise')
  const [wordCounts, setWordCounts] = useState({ short: 20, concise: 70, detailed: 110 })

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

  useEffect(() => {
    if (!session) return
    fetch('/api/github/status')
      .then((r) => r.json())
      .then((d) => {
        setGithubConnected(!!d.connected)
      })
      .catch(() => {})
  }, [session])

  // Reset suggestions when date changes
  useEffect(() => {
    if (suggestionsDate && suggestionsDate !== date) {
      setSuggestions([])
      setSuggestionsDate('')
    }
  }, [date, suggestionsDate])

  // Load recent project/task usage
  useEffect(() => {
    if (!session) return
    fetch('/api/usage/recent')
      .then((r) => r.json())
      .then((d) => {
        setRecentProjects(d.recentProjects || [])
        setRecentTasksByProject(d.recentTasksByProject || {})
      })
      .catch(() => {})
  }, [session])

  // Load word count settings
  useEffect(() => {
    if (!session) return
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (!d || d.error) return
        const mode = d.wordCountMode
        if (mode === 'short' || mode === 'concise' || mode === 'detailed' || mode === 'none') setWordCountMode(mode)
        setWordCounts({
          short: d.wordCountShort || 20,
          concise: d.wordCountConcise || 70,
          detailed: d.wordCountDetailed || 110,
        })
      })
      .catch(() => {})
  }, [session])

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
          projectId: entry.projectId,
          projectName: entry.projectName,
          taskName: entry.taskName,
          hours: entry.hours,
          hint: entry.aiHint,
          date,
          wordCount: wordCountMode === 'none' ? null : wordCounts[wordCountMode],
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
    if (!pushOdoo && !sendEmail) {
      toast.error('Select at least one action (Odoo or Email)')
      return
    }
    setSubmitting(true)
    try {
      // Strip transient UI fields, keep __repo for learning
      const cleanEntries = valid.map((e) => ({
        projectId: e.projectId,
        projectName: e.projectName,
        taskId: e.taskId,
        taskName: e.taskName,
        hours: e.hours,
        description: e.description,
        status: e.status,
        ...(e.__repo ? { __repo: e.__repo } : {}),
      }))
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, entries: cleanEntries, pushOdoo, sendEmail }),
      })
      const data = await res.json()

      const parts: string[] = []
      let allOk = true
      if (pushOdoo) {
        if (data.odooErrors.length === 0) parts.push(`Odoo: ${data.odoo.length} entries`)
        else { parts.push(`Odoo: ${data.odoo.length} ok, ${data.odooErrors.length} failed`); allOk = false }
      }
      if (sendEmail) {
        if (data.emailSent) parts.push('Email sent')
        else { parts.push(`Email failed: ${data.emailError}`); allOk = false }
      }
      const msg = parts.join(' · ')
      if (allOk) toast.success(msg)
      else toast.error(msg)
    } catch {
      toast.error('Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const fetchSuggestions = async (force = false): Promise<Suggestion[] | null> => {
    if (!force && suggestionsDate === date && suggestions.length > 0) return suggestions
    setLoadingSuggestions(true)
    try {
      const res = await fetch(`/api/github/suggest?date=${date}`)
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to fetch GitHub activity')
        return null
      }
      const sugs: Suggestion[] = data.suggestions || []
      setSuggestions(sugs)
      setSuggestionsDate(date)
      return sugs
    } catch {
      toast.error('Network error')
      return null
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const buildEntryFromSuggestion = (s: Suggestion): TimesheetEntry => ({
    id: crypto.randomUUID(),
    projectId: s.projectId,
    projectName: s.projectName,
    taskId: s.taskId,
    taskName: s.taskName,
    hours: s.hours,
    description: s.description,
    status: 'Ongoing',
    tasks: [],
    loadingTasks: !!s.projectId,
    loadingAI: false,
    aiHint: '',
    __repo: s.repo,
    __isPersonal: s.isPersonal,
  })

  const fetchTasksForEntry = async (entryId: string, projectId: number) => {
    try {
      const tres = await fetch(`/api/odoo/tasks?projectId=${projectId}`)
      const tasks = tres.ok ? await tres.json() : []
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, tasks, loadingTasks: false } : e)))
    } catch {
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, loadingTasks: false } : e)))
    }
  }

  const pickRepoForEntry = (entryId: string, repo: string) => {
    const sug = suggestions.find((s) => s.repo === repo)
    const commitsAsHint = sug?.description || ''
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e
        const base = {
          ...e,
          __pickedRepo: repo,
          __repo: repo,
          aiHint: commitsAsHint,
          hours: e.hours,
        }
        if (sug?.projectId) {
          return {
            ...base,
            projectId: sug.projectId,
            projectName: sug.projectName,
            taskId: sug.taskId,
            taskName: sug.taskName,
            loadingTasks: !!sug.projectId,
          }
        }
        return base
      })
    )
    if (sug?.projectId) fetchTasksForEntry(entryId, sug.projectId)
  }

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewMeta, setPreviewMeta] = useState<{ subject: string; to: string[]; cc: string[]; bcc: string[] } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const openPreview = async () => {
    const valid = entries.filter(
      (e) => e.projectId && e.taskId && e.hours > 0 && e.description.trim()
    )
    if (!valid.length) {
      toast.error('Fill all fields for at least one entry')
      return
    }
    setLoadingPreview(true)
    setPreviewOpen(true)
    try {
      const cleanEntries = valid.map((e) => ({
        projectId: e.projectId,
        projectName: e.projectName,
        taskId: e.taskId,
        taskName: e.taskName,
        hours: e.hours,
        description: e.description,
        status: e.status,
      }))
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, entries: cleanEntries }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Preview failed')
        setPreviewOpen(false)
      } else {
        setPreviewHtml(data.html)
        setPreviewMeta({ subject: data.subject, to: data.to || [], cc: data.cc || [], bcc: data.bcc || [] })
      }
    } catch {
      toast.error('Network error')
      setPreviewOpen(false)
    } finally {
      setLoadingPreview(false)
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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Today</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Log work</h1>
        </div>
        <div className="flex items-center gap-3">
          <DatePicker value={date} onChange={setDate} className="w-full sm:w-52" />
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
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
            <div className="flex items-center justify-between border-b border-border bg-surface/60 px-5 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">
                  Entry {String(idx + 1).padStart(2, '0')}
                </span>
                {entry.__repo && (
                  <span
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] truncate max-w-[300px]',
                      entry.__isPersonal
                        ? 'border-warning/40 bg-warning/10 text-warning'
                        : 'border-accent/30 bg-accent/10 text-accent'
                    )}
                  >
                    <GithubIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{entry.__repo}</span>
                    {entry.__isPersonal && <span className="ml-1">· personal</span>}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
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
            </div>

            <div className="space-y-4 px-5 py-4">
              {githubConnected && (
                <DropdownMenu onOpenChange={(open) => { if (open) fetchSuggestions(false) }}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-border bg-surface/40 px-3 py-2 text-xs text-muted-foreground transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
                      title="Pick a GitHub repo"
                    >
                        <span className="flex items-center gap-2 min-w-0">
                          {loadingSuggestions ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                          ) : (
                            <Wand2 className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate">
                            {entry.__pickedRepo || 'Choose GitHub repo'}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider opacity-60 shrink-0">
                          ▼
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
                      <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Repos with activity on {date}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(() => {
                        const usedRepos = new Set(
                          entries
                            .filter((e) => e.id !== entry.id && e.__pickedRepo)
                            .map((e) => e.__pickedRepo!)
                        )
                        const available = suggestions.filter((s) => !usedRepos.has(s.repo))
                        if (loadingSuggestions) return <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
                        if (available.length === 0) {
                          return (
                            <DropdownMenuItem disabled>
                              {suggestions.length === 0 ? 'No commits this date' : 'All repos used by other entries'}
                            </DropdownMenuItem>
                          )
                        }
                        return available.map((s) => (
                          <DropdownMenuItem
                            key={s.repo}
                            onSelect={() => pickRepoForEntry(entry.id, s.repo)}
                            className="flex flex-col items-start gap-0.5 py-2"
                          >
                            <div className="flex w-full items-center justify-between">
                              <span className="font-mono text-xs truncate">{s.repo}</span>
                              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                                {s.commitCount}c
                              </span>
                            </div>
                            {s.projectId && (
                              <span className="text-[10px] text-accent truncate w-full">
                                ✓ {s.projectName} → {s.taskName}
                              </span>
                            )}
                          </DropdownMenuItem>
                        ))
                      })()}
                    </DropdownMenuContent>
                  </DropdownMenu>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Project
                  </Label>
                  <Combobox
                    items={projects.map((p) => ({ value: p.id.toString(), label: p.name }))}
                    value={entry.projectId?.toString() || null}
                    onChange={(v) => handleProjectChange(entry.id, Number(v))}
                    disabled={loadingProjects}
                    placeholder={loadingProjects ? 'Loading projects…' : 'Select project…'}
                    searchPlaceholder="Search projects…"
                    emptyText="No project found."
                    recentValues={recentProjects.map((id) => id.toString())}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Task
                  </Label>
                  <Combobox
                    items={entry.tasks.map((t) => ({ value: t.id.toString(), label: t.name }))}
                    value={entry.taskId?.toString() || null}
                    onChange={(v) => handleTaskChange(entry.id, Number(v))}
                    disabled={!entry.projectId || entry.loadingTasks}
                    placeholder={
                      entry.loadingTasks
                        ? 'Loading tasks…'
                        : !entry.projectId
                        ? 'Select project first'
                        : 'Select task…'
                    }
                    searchPlaceholder="Search tasks…"
                    emptyText="No task found."
                    recentValues={
                      entry.projectId
                        ? (recentTasksByProject[entry.projectId.toString()] || []).map((id) => id.toString())
                        : []
                    }
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Status
                  </Label>
                  
                  {/* Mobile Dropdown */}
                  <div className="sm:hidden">
                    <Select value={entry.status} onValueChange={(v) => updateEntry(entry.id, { status: v })}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_BG[s] || 'currentColor' }} />
                              {s}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Desktop Buttons */}
                  <div className="hidden sm:flex flex-wrap gap-1.5">
                    {STATUSES.map((s) => {
                      const active = entry.status === s
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateEntry(entry.id, { status: s })}
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
                </div>
                <div className="shrink-0 space-y-2">
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
                    className="w-24 font-mono"
                  />
                </div>
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

                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-start">
                  <Textarea
                    value={entry.aiHint}
                    onChange={(e) => updateEntry(entry.id, { aiHint: e.target.value })}
                    placeholder="Hint for AI (optional)…"
                    rows={1}
                    className="flex-1 text-xs resize-none py-2 min-h-9 [field-sizing:content] max-h-48"
                  />
                  <div className="flex items-center gap-2">
                    <Select value={wordCountMode} onValueChange={(v) => setWordCountMode(v as 'short' | 'concise' | 'detailed' | 'none')}>
                      <SelectTrigger className="h-9 w-[110px] shrink-0 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short" className="text-xs">Short (~{wordCounts.short}w)</SelectItem>
                        <SelectItem value="concise" className="text-xs">Concise (~{wordCounts.concise}w)</SelectItem>
                        <SelectItem value="detailed" className="text-xs">Detailed (~{wordCounts.detailed}w)</SelectItem>
                        <SelectItem value="none" className="text-xs">None</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => generateDescription(entry.id)}
                      disabled={!entry.projectId || !entry.taskId || entry.loadingAI}
                      size="sm"
                      className="flex-1 sm:flex-none shrink-0 gap-1.5 bg-accent text-accent-foreground hover:opacity-90"
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

      <div className="mt-8 rounded-xl border border-border bg-surface/40 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
          On submit
        </p>
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Push to Odoo timesheet</p>
                <p className="text-xs text-muted-foreground">Create one timesheet entry per row</p>
              </div>
            </div>
            <Switch checked={pushOdoo} onCheckedChange={setPushOdoo} />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Send work report email</p>
                <p className="text-xs text-muted-foreground">Gmail to recipients in Settings</p>
              </div>
            </div>
            <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
          </label>
        </div>

        <Button
          onClick={sendEmail ? openPreview : handleSubmit}
          disabled={submitting || (!pushOdoo && !sendEmail)}
          size="lg"
          className="mt-5 w-full gap-2 bg-accent text-accent-foreground hover:opacity-90"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sendEmail ? (
            <Eye className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting
            ? 'Submitting…'
            : !pushOdoo && !sendEmail
            ? 'Select an action'
            : sendEmail
            ? 'Preview & send'
            : 'Submit · Odoo only'}
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>
              This is what your team will see. {pushOdoo && 'Odoo timesheet entries will also be created.'}
            </DialogDescription>
          </DialogHeader>
          {previewMeta && !loadingPreview && (
            <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-xs font-mono space-y-1">
              <div className="flex gap-2"><span className="text-muted-foreground w-14 shrink-0">Subject</span><span className="text-foreground break-all">{previewMeta.subject}</span></div>
              <div className="flex gap-2"><span className="text-muted-foreground w-14 shrink-0">To</span><span className="text-foreground">{previewMeta.to.join(', ') || '—'}</span></div>
              {previewMeta.cc.length > 0 && <div className="flex gap-2"><span className="text-muted-foreground w-14 shrink-0">CC</span><span className="text-foreground">{previewMeta.cc.join(', ')}</span></div>}
              {previewMeta.bcc.length > 0 && <div className="flex gap-2"><span className="text-muted-foreground w-14 shrink-0">BCC</span><span className="text-foreground">{previewMeta.bcc.join(', ')}</span></div>}
            </div>
          )}
          <div className="flex-1 overflow-hidden rounded-md border border-border bg-white">
            {loadingPreview ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
              </div>
            ) : (
              <iframe
                title="Email preview"
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
              onClick={() => {
                setPreviewOpen(false)
                handleSubmit()
              }}
              disabled={submitting || loadingPreview}
              className="gap-2 bg-accent text-accent-foreground hover:opacity-90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {pushOdoo && sendEmail ? 'Send · Odoo + Email' : sendEmail ? 'Send email' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
