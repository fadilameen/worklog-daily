'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { cn } from '@/lib/utils'

interface Settings {
  odooUrl: string
  odooDatabase: string
  odooUsername: string
  odooPassword: string
  emailRecipients: string
  emailCc: string
  emailBcc: string
}

const defaults: Settings = {
  odooUrl: '',
  odooDatabase: '',
  odooUsername: '',
  odooPassword: '',
  emailRecipients: '',
  emailCc: '',
  emailBcc: '',
}

const inputClass =
  'w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [testingOdoo, setTestingOdoo] = useState(false)
  const [odooTestResult, setOdooTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  useEffect(() => {
    if (!session) return
    fetch('/api/settings')
      .then(async (r) => {
        if (!r.ok) return
        const data = await r.json()
        if (data && !data.error) setSettings({ ...defaults, ...data })
      })
      .finally(() => setLoading(false))
  }, [session])

  const set = (key: keyof Settings, value: string | number) =>
    setSettings((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSaveError(err.error || `Error ${res.status}`)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setSaveError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const testOdoo = async () => {
    setTestingOdoo(true)
    setOdooTestResult(null)
    try {
      const res = await fetch('/api/settings/test-odoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.odooUrl,
          database: settings.odooDatabase,
          username: settings.odooUsername,
          password: settings.odooPassword,
        }),
      })
      const data = await res.json()
      setOdooTestResult(
        res.ok
          ? { ok: true, msg: `Connected — User ID: ${data.uid}` }
          : { ok: false, msg: data.error }
      )
    } catch {
      setOdooTestResult({ ok: false, msg: 'Network error' })
    } finally {
      setTestingOdoo(false)
    }
  }

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

  const field = (
    label: string,
    key: keyof Settings,
    opts: { type?: string; placeholder?: string } = {}
  ) => (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{label}</label>
      <input
        type={opts.type || 'text'}
        value={settings[key] as string}
        onChange={(e) =>
          set(key, opts.type === 'number' ? parseInt(e.target.value) : e.target.value)
        }
        placeholder={opts.placeholder}
        className={inputClass}
      />
    </div>
  )

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Configure your Odoo connection and email delivery.</p>
        </div>

        {/* Odoo Connection Card */}
        <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mb-5 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            {/* Odoo icon */}
            <div className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Odoo Connection</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Connect to your Odoo instance to sync timesheets.</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {field('Server URL', 'odooUrl', { placeholder: 'https://mycompany.odoo.com' })}
            {field('Database', 'odooDatabase', { placeholder: 'mycompany' })}
            {field('Username', 'odooUsername', { placeholder: 'admin@company.com' })}
            {field('Password', 'odooPassword', { type: 'password', placeholder: '••••••••' })}
          </div>

          <div className="px-6 pb-5 flex items-center gap-3">
            <button
              onClick={testOdoo}
              disabled={testingOdoo || !settings.odooUrl}
              className="text-sm px-4 py-2 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-400 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-40 font-medium"
            >
              {testingOdoo ? (
                <span className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 border border-violet-400 border-t-transparent rounded-full animate-spin" />
                  Testing…
                </span>
              ) : (
                'Test Connection'
              )}
            </button>
            {odooTestResult && (
              <span
                className={cn(
                  'text-xs font-medium flex items-center gap-1',
                  odooTestResult.ok ? 'text-emerald-600' : 'text-red-500'
                )}
              >
                {odooTestResult.ok ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {odooTestResult.msg}
              </span>
            )}
          </div>
        </section>

        {/* Email Card */}
        <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mb-8 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <div className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Email Report</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Sent from your Gmail account automatically.</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {field('To — Recipients (comma-separated)', 'emailRecipients', {
              placeholder: 'manager@company.com, team@company.com',
            })}
            {field('CC (comma-separated)', 'emailCc', {
              placeholder: 'cc@company.com',
            })}
            {field('BCC (comma-separated)', 'emailBcc', {
              placeholder: 'bcc@company.com',
            })}
          </div>

          <div className="px-6 pb-5">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Emails are sent via Gmail API using your signed-in Google account ({session?.user?.email}). No SMTP setup needed.
            </p>
          </div>
        </section>

        {/* Save row */}
        <div className="flex items-center justify-end gap-3">
          {saveError && (
            <span className="text-sm text-red-500 font-medium">{saveError}</span>
          )}
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className={cn(
              'px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all duration-150 shadow-sm',
              saving
                ? 'bg-violet-300 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-700 active:scale-[0.99]'
            )}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
