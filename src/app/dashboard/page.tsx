'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { formatDate, formatDisplayDate, cn } from '@/lib/utils'

interface OdooRecord {
  id: number
  name: string
}

const STATUSES = ['Completed', 'Ongoing', 'On-Hold', 'On-Queue'] as const

const STATUS_COLORS: Record<string, string> = {
  'Completed': '#6aa84f',
  'Ongoing': '#ffd966',
  'On-Hold': '#e06666',
  'On-Queue': '#6d9eeb',
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

const inputClass =
  'w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [date, setDate] = useState(formatDate())
  const [projects, setProjects] = useState<OdooRecord[]>([])
  const [entries, setEntries] = useState<TimesheetEntry[]>([makeEntry()])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [projectsError, setProjectsError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{
    odoo: number[]
    odooErrors: string[]
    emailSent: boolean
    emailError: string
  } | null>(null)

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
    } finally {
      updateEntry(id, { loadingAI: false })
    }
  }

  const handleSubmit = async () => {
    const valid = entries.filter(
      (e) => e.projectId && e.taskId && e.hours > 0 && e.description.trim()
    )
    if (!valid.length) {
      alert('Fill all fields (project, task, hours, description) for at least one entry.')
      return
    }
    setSubmitting(true)
    setSubmitResult(null)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, entries: valid }),
      })
      setSubmitResult(await res.json())
    } finally {
      setSubmitting(false)
    }
  }

  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0)

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Log Work</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">{formatDisplayDate(date)}</p>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow bg-white dark:bg-slate-800"
          />
        </div>

        {/* Banners */}
        {projectsError && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {projectsError === 'Odoo not configured' ? (
              <>
                Odoo not configured.{' '}
                <a href="/settings" className="font-semibold underline underline-offset-2">
                  Go to Settings
                </a>
              </>
            ) : (
              projectsError
            )}
          </div>
        )}

        {loadingProjects && (
          <div className="mb-5 flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
            <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            Loading projects from Odoo…
          </div>
        )}

        {submitResult && (
          <div
            className={cn(
              'mb-5 px-4 py-3 rounded-lg border text-sm flex items-start gap-3',
              submitResult.odooErrors.length === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            )}
          >
            <span className="text-base leading-none mt-0.5">
              {submitResult.odooErrors.length === 0 ? '✓' : '⚠'}
            </span>
            <div>
              <p className="font-semibold mb-0.5">Submission result</p>
              <p className="text-xs opacity-80">
                Odoo: {submitResult.odoo.length} entr{submitResult.odoo.length === 1 ? 'y' : 'ies'} created
                {submitResult.odooErrors.length > 0 &&
                  ` · ${submitResult.odooErrors.length} failed: ${submitResult.odooErrors.join(', ')}`}
              </p>
              <p className="text-xs opacity-80">
                Email: {submitResult.emailSent ? 'Sent' : `Failed — ${submitResult.emailError}`}
              </p>
            </div>
          </div>
        )}

        {/* Entry cards */}
        <div className="space-y-4">
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Entry {idx + 1}
                </span>
                {entries.length > 1 && (
                  <button
                    onClick={() => setEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                    className="text-xs text-slate-400 dark:text-slate-600 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="px-5 py-5 space-y-4">
                {/* Row 1: Project + Task */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Project</label>
                    <select
                      value={entry.projectId || ''}
                      onChange={(e) => handleProjectChange(entry.id, Number(e.target.value))}
                      className={inputClass}
                      disabled={loadingProjects}
                    >
                      <option value="">Select project…</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Task</label>
                    <select
                      value={entry.taskId || ''}
                      onChange={(e) => handleTaskChange(entry.id, Number(e.target.value))}
                      className={inputClass}
                      disabled={!entry.projectId || entry.loadingTasks}
                    >
                      <option value="">
                        {entry.loadingTasks
                          ? 'Loading tasks…'
                          : !entry.projectId
                          ? 'Select project first'
                          : 'Select task…'}
                      </option>
                      {entry.tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Status */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateEntry(entry.id, { status: s })}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold border transition-all"
                        style={
                          entry.status === s
                            ? { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s], color: s === 'Ongoing' ? '#7a5c00' : '#fff' }
                            : { backgroundColor: 'transparent', borderColor: '#e2e8f0', color: '#64748b' }
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 3: Hours */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Hours</label>
                  <input
                    type="number"
                    min="0.25"
                    max="24"
                    step="0.25"
                    value={entry.hours}
                    onChange={(e) =>
                      updateEntry(entry.id, { hours: parseFloat(e.target.value) || 0 })
                    }
                    className="w-28 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow"
                    style={{ fontFamily: 'var(--font-dm-mono, monospace)' }}
                  />
                </div>

                {/* Row 4: Description + AI */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={entry.description}
                    onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                    rows={3}
                    placeholder="Describe what you worked on…"
                    className={cn(inputClass, 'resize-none')}
                  />

                  {/* AI Generate row */}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={entry.aiHint}
                      onChange={(e) => updateEntry(entry.id, { aiHint: e.target.value })}
                      placeholder="Brief hint for AI (optional)…"
                      className="flex-1 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow"
                    />
                    <button
                      onClick={() => generateDescription(entry.id)}
                      disabled={!entry.projectId || !entry.taskId || entry.loadingAI}
                      className={cn(
                        'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150',
                        entry.loadingAI
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                          : !entry.projectId || !entry.taskId
                          ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                          : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                      )}
                    >
                      {entry.loadingAI ? (
                        <>
                          <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                          Generating…
                        </>
                      ) : (
                        <>
                          <span>✦</span>
                          Generate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between mt-4 px-1">
          <button
            onClick={() => setEntries((prev) => [...prev, makeEntry()])}
            className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:text-violet-800 dark:hover:text-violet-300 transition-colors flex items-center gap-1"
          >
            <span className="text-base leading-none">+</span> Add entry
          </button>
          <span
            className="text-sm text-slate-500 dark:text-slate-400"
            style={{ fontFamily: 'var(--font-dm-mono, monospace)' }}
          >
            {totalHours.toFixed(1)}h total
          </span>
        </div>

        {/* Submit */}
        <div className="mt-8">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={cn(
              'w-full py-3 rounded-lg font-semibold text-sm text-white transition-all duration-150 shadow-sm',
              submitting
                ? 'bg-violet-300 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-700 active:scale-[0.99]'
            )}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Submitting…
              </span>
            ) : (
              'Submit Report'
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
