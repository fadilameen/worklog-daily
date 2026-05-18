'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface GithubState {
  connected: boolean
  username: string | null
}

export function useGithubConnection() {
  const { data: session } = useSession()
  const [state, setState] = useState<GithubState>({ connected: false, username: null })

  const refresh = () => {
    fetch('/api/github/status')
      .then((r) => r.json())
      .then((d) => setState({ connected: !!d.connected, username: d.username || null }))
      .catch(() => {})
  }

  useEffect(() => {
    if (session) refresh()
  }, [session])

  const disconnect = async () => {
    await fetch('/api/github/status', { method: 'DELETE' })
    refresh()
  }

  return { ...state, refresh, disconnect }
}
