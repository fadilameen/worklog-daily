'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleIcon } from '@/components/icons'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session) router.push('/dashboard')
  }, [session, router])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    )
  }

  const handleGoogle = () => {
    setBusy(true)
    signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Left: brand */}
      <div className="hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-2">
          <img src="/logo-wordmark.svg" alt="WorkLog" className="h-10" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="space-y-6"
        >
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
            log once · sync everywhere
          </p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
            Fill one form.
            <br />
            <span className="text-muted-foreground">Hit submit.</span>
            <br />
            <span className="text-accent">Done for the day.</span>
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Your daily entries push to Odoo timesheets and email your team —
            from the same form, at the same time.
          </p>
        </motion.div>

        <p className="font-mono text-xs text-muted-foreground">© WorkLog</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="lg:hidden flex items-center gap-2">
            <img src="/logo-wordmark.svg" alt="WorkLog" className="h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with your Google account to log today&rsquo;s work.
            </p>
          </div>

          <Button
            onClick={handleGoogle}
            disabled={busy}
            variant="outline"
            className="w-full justify-center gap-2 border-border bg-surface hover:bg-surface-2"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>

          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center">
            For team use · Built for Odoo
          </p>
        </motion.div>
      </div>
    </div>
  )
}

