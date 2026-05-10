import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'WorkLog – Daily Timesheet & Reports',
  description: 'Submit daily work reports to Odoo and email in one click',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable}`}
    >
      <body className="min-h-screen antialiased" style={{ fontFamily: 'var(--font-dm-sans), system-ui, sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
