'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { CalendarDays, CalendarRange, History, Settings, LogOut, CheckCircle2, Plus, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { GoogleIcon, GithubIcon } from '@/components/icons'

const NAV = [
  { href: '/dashboard', label: 'Today', icon: CalendarDays },
  { href: '/weekly', label: 'Weekly', icon: CalendarRange },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [github, setGithub] = useState<{ connected: boolean; username: string | null }>({
    connected: false,
    username: null,
  })

  useEffect(() => { setMounted(true) }, [])

  const refreshGithub = () => {
    fetch('/api/github/status')
      .then((r) => r.json())
      .then((d) => setGithub({ connected: !!d.connected, username: d.username || null }))
      .catch(() => {})
  }

  useEffect(() => {
    if (session) refreshGithub()
  }, [session])

  const disconnectGithub = async () => {
    await fetch('/api/github/status', { method: 'DELETE' })
    refreshGithub()
  }

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 overflow-y-auto">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/logo-icon.svg" alt="WorkLog" className="h-8 w-8" />
          <span className="font-semibold tracking-tight">WorkLog</span>
        </Link>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition hover:text-foreground"
          title="Toggle theme"
        >
          {mounted && theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition',
                active
                  ? 'bg-surface text-foreground'
                  : 'text-muted-foreground hover:bg-surface/60 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {/* Connections section */}
        <div className="space-y-1.5">
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Connections
          </p>

          {/* Google — always connected if signed in */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface/40 px-2.5 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <GoogleIcon className="h-3.5 w-3.5" />
              <span className="text-xs">Google</span>
            </div>
            <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
          </div>

          {/* GitHub */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface/40 px-2.5 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <GithubIcon className="h-3.5 w-3.5 shrink-0 text-foreground" />
              <span className="text-xs truncate">
                {github.connected ? github.username : 'GitHub'}
              </span>
            </div>
            {github.connected ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                <button
                  onClick={disconnectGithub}
                  className="text-[10px] font-mono uppercase text-muted-foreground hover:text-destructive"
                  title="Disconnect"
                >
                  ×
                </button>
              </div>
            ) : (
              <a
                href="/api/github/connect"
                className="flex items-center gap-0.5 text-[10px] font-mono uppercase text-accent hover:underline"
              >
                <Plus className="h-3 w-3" />
                Connect
              </a>
            )}
          </div>
        </div>

        {/* Profile */}
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="truncate text-xs font-medium">{session?.user?.name ?? session?.user?.email}</p>
          <p className="truncate text-[11px] text-muted-foreground">{session?.user?.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

