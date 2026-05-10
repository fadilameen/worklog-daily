'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { formatDisplayDate, cn } from '@/lib/utils'

interface Entry {
  projectName: string
  taskName: string
  hours: number
  description: string
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

  if (loading || status === 'loading') {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    )
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">History</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">All your submitted work reports.</p>
        </div>

        {/* Empty state */}
        {submissions.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 py-16 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No submissions yet</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
              Log work from the{' '}
              <a href="/dashboard" className="text-violet-600 hover:underline">
                dashboard
              </a>{' '}
              to see your history here.
            </p>
          </div>
        )}

        {/* Submission list */}
        <div className="space-y-5">
          {submissions.map((s) => {
            const total = s.entries.reduce((sum, e) => sum + e.hours, 0)
            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {formatDisplayDate(s.date)}
                    </span>
                    <span
                      className="text-xs text-slate-400 dark:text-slate-500"
                      style={{ fontFamily: 'var(--font-dm-mono, monospace)' }}
                    >
                      {total.toFixed(1)}h
                    </span>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium',
                        s.odooSynced
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-600 border border-red-200'
                      )}
                    >
                      {s.odooSynced ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      Odoo
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium',
                        s.emailSent
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-red-50 text-red-600 border border-red-200'
                      )}
                    >
                      {s.emailSent ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      Email
                    </span>
                  </div>
                </div>

                {/* Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        Project
                      </th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        Task
                      </th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-20">
                        Hours
                      </th>
                      <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.entries.map((e, i) => (
                      <tr
                        key={i}
                        className={cn(
                          'border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/50',
                          i % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-800/20' : ''
                        )}
                      >
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300 text-sm font-medium">
                          {e.projectName}
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-400 text-sm">{e.taskName}</td>
                        <td
                          className="px-5 py-3 text-slate-600 dark:text-slate-400 text-sm"
                          style={{ fontFamily: 'var(--font-dm-mono, monospace)' }}
                        >
                          {e.hours}h
                        </td>
                        <td className="px-5 py-3 text-slate-400 dark:text-slate-500 text-sm max-w-xs truncate">
                          {e.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
