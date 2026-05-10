import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'GitHub not configured' }, { status: 500 })

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/github/callback`
  const state = session.user.id
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,read:user&state=${state}`

  return NextResponse.redirect(url)
}
