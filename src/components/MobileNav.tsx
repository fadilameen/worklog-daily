'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, CalendarRange, History, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard', label: 'Today', icon: CalendarDays },
  { href: '/weekly', label: 'Weekly', icon: CalendarRange },
  { href: '/history', label: 'History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-[calc(4.5rem+env(safe-area-inset-bottom))] items-center justify-around border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-1 h-full"
          >
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 w-16 h-12 rounded-xl transition-all',
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5px]')} />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
