'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Sun, Moon, Menu, X, CheckCircle2, Plus, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import { GoogleIcon, GithubIcon } from '@/components/icons'

export function MobileHeader() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
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
    if (session && open) refreshGithub()
  }, [session, open])

  const disconnectGithub = async () => {
    await fetch('/api/github/status', { method: 'DELETE' })
    refreshGithub()
  }

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [open])

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img src="/logo-icon.svg" alt="WorkLog" className="h-6 w-6" />
          <span className="font-semibold tracking-tight">WorkLog</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition hover:text-foreground"
            title="Toggle theme"
          >
            {mounted && theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition hover:text-foreground"
            title="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <span className="font-semibold tracking-tight">Menu</span>
            <button
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-3">
              <p className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Connections
              </p>
              
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface/40 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <GoogleIcon className="h-4 w-4" />
                  <span className="text-sm">Google</span>
                </div>
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
              </div>

              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface/40 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <GithubIcon className="h-4 w-4 shrink-0 text-foreground" />
                  <span className="text-sm truncate">
                    {github.connected ? github.username : 'GitHub'}
                  </span>
                </div>
                {github.connected ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <button
                      onClick={disconnectGithub}
                      className="text-[10px] font-mono uppercase text-muted-foreground hover:text-destructive"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <a
                    href="/api/github/connect"
                    className="flex items-center gap-1 text-[10px] font-mono uppercase text-accent hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Connect
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <p className="px-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Account
              </p>
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="truncate text-sm font-medium">{session?.user?.name ?? session?.user?.email}</p>
                <p className="truncate text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-surface/80 hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
