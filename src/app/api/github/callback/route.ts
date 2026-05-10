import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.redirect(new URL('/', request.url))

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || state !== session.user.id) {
    return NextResponse.redirect(new URL('/dashboard?github=error', request.url))
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/github/callback`,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL('/dashboard?github=error', request.url))
  }

  const ghHeaders = { Authorization: `Bearer ${tokenData.access_token}` }
  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers: ghHeaders }),
    fetch('https://api.github.com/user/emails', { headers: ghHeaders }),
  ])
  const userData = await userRes.json()
  const emailsData = emailsRes.ok ? await emailsRes.json() : []
  if (!userData.login) {
    return NextResponse.redirect(new URL('/dashboard?github=error', request.url))
  }

  const emails = Array.isArray(emailsData)
    ? (emailsData as Array<{ email: string; verified?: boolean }>).map((e) => e.email).join(',')
    : (userData.email || '')
  const name = userData.name || ''

  await prisma.githubAuth.upsert({
    where: { userId: session.user.id },
    update: { accessToken: tokenData.access_token, username: userData.login, name, emails },
    create: {
      userId: session.user.id,
      accessToken: tokenData.access_token,
      username: userData.login,
      name,
      emails,
    },
  })

  return NextResponse.redirect(new URL('/dashboard?github=connected', request.url))
}
