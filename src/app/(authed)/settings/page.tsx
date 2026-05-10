'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, KeyRound, Mail, Users, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

interface Settings {
  odooUrl: string
  odooDatabase: string
  odooUsername: string
  odooPassword: string
  emailRecipients: string
  emailCc: string
  emailBcc: string
  emailSignature: string
  descriptionStyle: string
  weeklyFilterTo: string
}

const defaults: Settings = {
  odooUrl: '',
  odooDatabase: '',
  odooUsername: '',
  odooPassword: '',
  emailRecipients: '',
  emailCc: '',
  emailBcc: '',
  emailSignature: '',
  descriptionStyle: '',
  weeklyFilterTo: '',
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingOdoo, setTestingOdoo] = useState(false)
  const [odooVerified, setOdooVerified] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/')
  }, [status, router])

  useEffect(() => {
    if (!session) return
    fetch('/api/settings')
      .then(async (r) => {
        if (!r.ok) return
        const data = await r.json()
        if (data && !data.error) {
          setSettings({ ...defaults, ...data })
          setOdooVerified(!!data.odooUrl && !!data.odooUsername)
        }
      })
      .finally(() => setLoading(false))
  }, [session])

  const set = (key: keyof Settings, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || `Error ${res.status}`)
      } else {
        toast.success('Settings saved')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const testOdoo = async () => {
    setTestingOdoo(true)
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
      if (res.ok) {
        toast.success(`Connected — User ID: ${data.uid}`)
        setOdooVerified(true)
      } else {
        toast.error(data.error || 'Connection failed')
        setOdooVerified(false)
      }
    } catch {
      toast.error('Network error')
    } finally {
      setTestingOdoo(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10 lg:py-14">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Configuration</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect Odoo and configure who receives your daily report.
        </p>
      </header>

      <Tabs defaultValue="odoo" className="mt-8">
        <TabsList>
          <TabsTrigger value="odoo" className="gap-2">
            <KeyRound className="h-4 w-4" /> Odoo
          </TabsTrigger>
          <TabsTrigger value="gmail" className="gap-2">
            <Mail className="h-4 w-4" /> Gmail
          </TabsTrigger>
          <TabsTrigger value="recipients" className="gap-2">
            <Users className="h-4 w-4" /> Recipients
          </TabsTrigger>
          <TabsTrigger value="style" className="gap-2">
            <Sparkles className="h-4 w-4" /> AI Style
          </TabsTrigger>
        </TabsList>

        <TabsContent value="odoo" className="mt-6">
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Odoo connection</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your personal Odoo credentials. Used to push timesheet entries.
                </p>
              </div>
              <ConnStatus ok={odooVerified} okLabel="Verified" offLabel="Not verified" />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Server URL">
                <Input value={settings.odooUrl} onChange={(e) => set('odooUrl', e.target.value)} placeholder="https://mycompany.odoo.com" />
              </Field>
              <Field label="Database">
                <Input value={settings.odooDatabase} onChange={(e) => set('odooDatabase', e.target.value)} placeholder="mycompany" />
              </Field>
              <Field label="Username (email)">
                <Input value={settings.odooUsername} onChange={(e) => set('odooUsername', e.target.value)} placeholder="you@company.com" />
              </Field>
              <Field label="Password / API key">
                <Input type="password" value={settings.odooPassword} onChange={(e) => set('odooPassword', e.target.value)} placeholder="••••••••" />
              </Field>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Test the connection before saving.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={testOdoo} disabled={testingOdoo || !settings.odooUrl}>
                  {testingOdoo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test connection'}
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="gmail" className="mt-6">
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Gmail send access</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reports are sent through your signed-in Gmail account.
                </p>
              </div>
              <ConnStatus ok={!!session?.user?.email} okLabel="Connected" offLabel="Not connected" />
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-surface/40 p-4">
              <div>
                <p className="text-sm font-medium">{session?.user?.email}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">scope: gmail.send</p>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-accent">via OAuth</span>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              No SMTP setup needed. Sign out and back in to refresh access.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="recipients" className="mt-6">
          <Card>
            <h2 className="text-lg font-semibold">Email recipients</h2>
            <p className="mt-1 text-sm text-muted-foreground">Comma-separated email addresses per role.</p>

            <div className="mt-6 space-y-4">
              <Field label="To">
                <Input value={settings.emailRecipients} onChange={(e) => set('emailRecipients', e.target.value)} placeholder="manager@company.com, team@company.com" />
              </Field>
              <Field label="CC">
                <Input value={settings.emailCc} onChange={(e) => set('emailCc', e.target.value)} placeholder="cc@company.com" />
              </Field>
              <Field label="BCC">
                <Input value={settings.emailBcc} onChange={(e) => set('emailBcc', e.target.value)} placeholder="bcc@company.com" />
              </Field>
              <Field label="Weekly filter — fetch reports sent to">
                <Input
                  value={settings.weeklyFilterTo}
                  onChange={(e) => set('weeklyFilterTo', e.target.value)}
                  placeholder="manager@company.com"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Weekly report scans Gmail for daily reports sent to this address.
                </p>
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Email signature</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste your HTML signature (or plain text). Leave empty for default.
            </p>
            <div className="mt-5">
              <Textarea
                value={settings.emailSignature}
                onChange={(e) => set('emailSignature', e.target.value)}
                rows={10}
                placeholder="<div>Your name<br>Your title<br>Company</div>"
                className="font-mono text-xs resize-y"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="style" className="mt-6">
          <Card>
            <h2 className="text-lg font-semibold">Your writing style</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste an example description in your tone. AI matches its rhythm, technical density,
              and sentence structure for every generated description.
            </p>
            <div className="mt-5">
              <Textarea
                value={settings.descriptionStyle}
                onChange={(e) => set('descriptionStyle', e.target.value)}
                rows={14}
                placeholder="Paste a description you wrote that captures your style…"
                className="resize-y"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save style'}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-surface/40 p-6">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ConnStatus({ ok, okLabel, offLabel }: { ok: boolean; okLabel: string; offLabel: string }) {
  return ok ? (
    <span className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
      <CheckCircle2 className="h-3.5 w-3.5" /> {okLabel}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
      <XCircle className="h-3.5 w-3.5" /> {offLabel}
    </span>
  )
}
