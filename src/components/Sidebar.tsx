'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { CalendarDays, History, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard', label: 'Today', icon: CalendarDays },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-foreground font-mono text-sm font-bold">
          W
        </div>
        <span className="font-semibold tracking-tight">WorkLog</span>
      </Link>

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
