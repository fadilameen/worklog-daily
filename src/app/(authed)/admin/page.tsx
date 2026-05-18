'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Users, Send, GitBranch, Calendar, CheckCircle2, XCircle, Ban, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDisplayDate, cn } from '@/lib/utils'

interface AdminUser {
  id: string
  name: string | null
  email: string | null
  suspended: boolean
  githubAuth: { username: string } | null
  _count: { submissions: number; repoMappings: number }
  lastActiveAt: string | null
}

interface RecentSubmission {
  id: string
  date: string
  emailSent: boolean
  odooSynced: boolean
  createdAt: string
  user: { email: string | null; name: string | null }
}

interface Overview {
  users: AdminUser[]
  totalSubmissions: number
  submissionsThisWeek: number
  recentSubmissions: RecentSubmission[]
  repoMappingCount: number
}

export default function AdminPage() {
  const { status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  const refresh = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/overview')
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    refresh()
  }, [status, refresh])

  const runUserAction = async (
    id: string,
    init: RequestInit,
    { confirmMsg, successMsg, failMsg }: { confirmMsg: string; successMsg: string; failMsg: string }
  ) => {
    if (!confirm(confirmMsg)) return
    const res = await fetch(`/api/admin/users/${id}`, init)
    if (res.ok) { toast.success(successMsg); refresh() }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || failMsg) }
  }

  const setSuspended = (id: string, email: string | null, suspend: boolean) =>
    runUserAction(id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended: suspend }),
    }, {
      confirmMsg: suspend
        ? `Block ${email}? They will be signed out and unable to sign in until unblocked.`
        : `Unblock ${email}? They will be able to sign in again.`,
      successMsg: suspend ? 'Blocked' : 'Unblocked',
      failMsg: suspend ? 'Block failed' : 'Unblock failed',
    })

  const deleteUser = (id: string, email: string | null) =>
    runUserAction(id, { method: 'DELETE' }, {
      confirmMsg: `Delete account ${email}? All submissions, mappings, and settings will be removed. This cannot be undone.`,
      successMsg: 'Deleted',
      failMsg: 'Delete failed',
    })

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Overview</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Users} label="Users" value={data.users.length} />
        <Stat icon={Send} label="Submissions" value={data.totalSubmissions} />
        <Stat icon={Calendar} label="This week" value={data.submissionsThisWeek} />
        <Stat icon={GitBranch} label="Repo mappings" value={data.repoMappingCount} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Users</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">GitHub</th>
                <th className="px-4 py-2 text-right">Submissions</th>
                <th className="px-4 py-2 text-right">Repo maps</th>
                <th className="px-4 py-2">Last active</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className={cn('border-t border-border', u.suspended && 'opacity-60')}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {u.name || '—'}
                      {u.suspended && <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-destructive">Blocked</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{u.githubAuth?.username || '—'}</td>
                  <td className="px-4 py-2 text-right">{u._count.submissions}</td>
                  <td className="px-4 py-2 text-right">{u._count.repoMappings}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSuspended(u.id, u.email, !u.suspended)}
                        title={u.suspended ? 'Unblock — restore sign-in access' : 'Block — sign out + prevent future sign-in'}
                        className={cn(
                          'rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted-foreground',
                          u.suspended ? 'hover:text-accent' : 'hover:text-destructive'
                        )}
                      >
                        {u.suspended ? <Ban className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => deleteUser(u.id, u.email)}
                        title="Delete account"
                        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Recent submissions</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Odoo</th>
                <th className="px-4 py-2">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.recentSubmissions.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{s.user.email}</td>
                  <td className="px-4 py-2">{formatDisplayDate(s.date)}</td>
                  <td className="px-4 py-2">{s.emailSent ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</td>
                  <td className="px-4 py-2">{s.odooSynced ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}
