import { prisma } from '@/lib/db'

export const MERGE_RE = /^Merge (pull request|branch|remote-tracking branch|commit) /i

export interface GithubCommit {
  repo: string
  message: string
  sha: string
}

export interface BrowserCommit {
  sha: string
  message: string
  author: string
  date: string | null
}

type RawBrowserCommit = {
  sha: string
  commit: { message: string; author?: { name?: string; date?: string } }
}

export function mapBrowserCommit(c: RawBrowserCommit): BrowserCommit {
  return {
    sha: c.sha.slice(0, 7),
    message: c.commit.message.trim(),
    author: c.commit.author?.name || '',
    date: c.commit.author?.date || null,
  }
}

export async function getGithubContext(userId: string) {
  const auth = await prisma.githubAuth.findUnique({ where: { userId } })
  if (!auth) return null
  return {
    auth,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: 'application/vnd.github+json',
    } as const,
  }
}

export async function fetchCommitsAllBranches(
  repo: string,
  username: string,
  since: string,
  until: string,
  headers: { Authorization: string; Accept: string }
): Promise<GithubCommit[]> {

  const branchesRes = await fetch(
    `https://api.github.com/repos/${repo}/branches?per_page=100`,
    { headers }
  )
  if (!branchesRes.ok) return []

  const branches: Array<{ name: string }> = await branchesRes.json()
  if (!Array.isArray(branches) || !branches.length) return []

  const seenSha = new Set<string>()
  const commits: GithubCommit[] = []

  await Promise.all(
    branches.map(async (branch) => {
      const url =
        `https://api.github.com/repos/${repo}/commits` +
        `?sha=${encodeURIComponent(branch.name)}` +
        `&author=${encodeURIComponent(username)}` +
        `&since=${since}&until=${until}&per_page=100`
      const res = await fetch(url, { headers })
      if (!res.ok) return
      const data: Array<{ sha: string; commit: { message: string }; parents?: unknown[] }> =
        await res.json()
      if (!Array.isArray(data)) return
      for (const c of data) {
        if (seenSha.has(c.sha)) continue
        if (Array.isArray(c.parents) && c.parents.length > 1) continue
        if (MERGE_RE.test(c.commit.message.split('\n')[0].trim())) continue
        seenSha.add(c.sha)
        commits.push({ repo, message: c.commit.message.trim(), sha: c.sha })
      }
    })
  )

  return commits
}
