'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/ThemeProvider'

const links = [
  { href: '/dashboard', label: 'Log Work' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
]

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()

  if (!session) return null

  const initials = session.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10" style={{ height: '56px' }}>
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-full">
        {/* Left: Logotype */}
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="font-bold text-slate-900 dark:text-white text-base tracking-tight select-none">
            WorkLog
          </Link>

          {/* Center: Nav tabs */}
          <div className="flex items-center gap-0.5">
            {links.map((link) => {
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
                    active
                      ? 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right: Theme toggle + Avatar + Name + Sign out */}
        <div className="flex items-center gap-3">
          {/* Theme toggle button */}
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'light' ? (
              /* Sun icon — shown in light mode to switch to dark */
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              /* Moon icon — shown in dark mode to switch to light */
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>

          {session.user?.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || ''}
              className="w-7 h-7 rounded-full ring-1 ring-slate-200 dark:ring-slate-600"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center ring-1 ring-violet-200 dark:ring-violet-800">
              <span className="text-violet-700 text-xs font-semibold">{initials}</span>
            </div>
          )}
          <span className="text-sm text-slate-700 dark:text-slate-300 font-medium hidden sm:block">
            {session.user?.name?.split(' ')[0]}
          </span>
          <span className="text-slate-200 dark:text-slate-700 select-none">·</span>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-sm text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
