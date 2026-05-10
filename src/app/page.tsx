'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) router.push('/dashboard')
  }, [session, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-950 relative overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(circle, #e2e8f0 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
      }}
    >
      {/* Subtle gradient overlay on the dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.6) 60%, transparent 100%)',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 bg-violet-600 rounded-lg flex items-center justify-center mb-4 shadow-sm">
            <span
              className="text-white font-bold text-lg tracking-tight select-none"
              style={{ fontFamily: 'var(--font-dm-mono, monospace)' }}
            >
              WL
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">WorkLog</h1>
          <p className="text-slate-400 dark:text-slate-400 text-sm mt-1.5 text-center leading-snug">
            Your daily work, logged in one shot.
          </p>
        </div>

        {/* Sign-in card */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-8">
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 transition-all duration-150 shadow-sm"
          >
            {/* Google icon */}
            <svg className="w-4.5 h-4.5" width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 dark:text-slate-600 text-xs mt-6">
          Used by your team · Built for Odoo
        </p>
      </div>
    </div>
  )
}
