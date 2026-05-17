'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Search, GitCommitHorizontal, Lock, Globe, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Repo {
  fullName: string
  description: string | null
  private: boolean
  updatedAt: string
}

interface Commit {
  sha: string
  message: string
  author: string
  date: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  onLoad: (commits: string[], repo: string) => void
}

export function ManualRepoPicker({ open, onOpenChange, date, onLoad }: Props) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [reposError, setReposError] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [commitsError, setCommitsError] = useState('')
  const [dateFiltered, setDateFiltered] = useState(true)
  const [loadingCommits, setLoadingCommits] = useState(false)
  const [selectedShas, setSelectedShas] = useState<Set<string>>(new Set())
  const [mobilePanel, setMobilePanel] = useState<'repos' | 'commits'>('repos')
  // Snapshot date on open — parent date changes must not retrigger mid-browse fetch
  const snapshotDate = useRef(date)

  useEffect(() => {
    if (!open) return
    snapshotDate.current = date
    if (repos.length > 0) return
    const controller = new AbortController()
    setLoadingRepos(true)
    setReposError('')
    fetch('/api/github/repos', { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setRepos(Array.isArray(data) ? data : []))
      .catch((err) => { if (err.name !== 'AbortError') setReposError('Failed to load repos') })
      .finally(() => setLoadingRepos(false))
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!selectedRepo) return
    const controller = new AbortController()
    setLoadingCommits(true)
    setCommits([])
    setCommitsError('')
    setSelectedShas(new Set())
    fetch(
      `/api/github/repo-commits?repo=${encodeURIComponent(selectedRepo)}&date=${snapshotDate.current}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data) => {
        setCommits(data.commits || [])
        setDateFiltered(data.dateFiltered ?? true)
      })
      .catch((err) => { if (err.name !== 'AbortError') setCommitsError('Failed to load commits') })
      .finally(() => setLoadingCommits(false))
    return () => controller.abort()
  }, [selectedRepo])

  const filteredRepos = useMemo(() => {
    const q = repoSearch.toLowerCase()
    if (!q) return repos
    return repos.filter((r) => r.fullName.toLowerCase().includes(q))
  }, [repos, repoSearch])

  const groups = useMemo(() => {
    const map = new Map<string, Commit[]>()
    for (const c of commits) {
      const day = c.date
        ? new Date(c.date).toLocaleDateString('en-IN', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            timeZone: 'Asia/Kolkata',
          })
        : 'Unknown date'
      const arr = map.get(day)
      if (arr) arr.push(c)
      else map.set(day, [c])
    }
    return Array.from(map.entries()).map(([day, items]) => ({
      day,
      commits: items,
      shas: items.map((c) => c.sha),
    }))
  }, [commits])

  const toggleCommit = (sha: string) => {
    setSelectedShas((prev) => {
      const next = new Set(prev)
      if (next.has(sha)) next.delete(sha)
      else next.add(sha)
      return next
    })
  }

  // Reads selectedShas via setter callback — stable, no deps needed
  const toggleDay = useCallback((dayShas: string[]) => {
    setSelectedShas((prev) => {
      const allDaySelected = dayShas.every((s) => prev.has(s))
      const next = new Set(prev)
      if (allDaySelected) dayShas.forEach((s) => next.delete(s))
      else dayShas.forEach((s) => next.add(s))
      return next
    })
  }, [])

  const handleSelectRepo = (fullName: string) => {
    setSelectedRepo(fullName)
    setMobilePanel('commits')
  }

  const handleLoad = () => {
    if (!selectedRepo) return
    const selected = commits.filter((c) => selectedShas.has(c.sha))
    const messages = selected.length > 0 ? selected.map((c) => c.message) : commits.map((c) => c.message)
    onLoad(messages, selectedRepo)
    handleClose()
  }

  const handleClose = () => {
    onOpenChange(false)
    setSelectedRepo(null)
    setCommits([])
    setCommitsError('')
    setSelectedShas(new Set())
    setRepoSearch('')
    setMobilePanel('repos')
  }

  const loadCount = selectedShas.size || commits.length

  const repoListPanel = (
    <div className={cn(
      'flex flex-col overflow-hidden',
      'sm:w-60 sm:shrink-0 sm:border-r sm:border-border',
      mobilePanel === 'repos' ? 'flex w-full' : 'hidden sm:flex',
    )}>
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search repos…"
            value={repoSearch}
            onChange={(e) => setRepoSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loadingRepos ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : reposError ? (
          <p className="px-3 py-4 text-xs text-destructive">{reposError}</p>
        ) : filteredRepos.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">No repos found</p>
        ) : (
          filteredRepos.map((repo) => (
            <button
              key={repo.fullName}
              onClick={() => handleSelectRepo(repo.fullName)}
              className={cn(
                'w-full flex items-start gap-2 px-3 py-2.5 text-left text-xs transition hover:bg-surface/60',
                selectedRepo === repo.fullName && 'bg-accent/10 text-accent'
              )}
            >
              {repo.private ? (
                <Lock className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
              ) : (
                <Globe className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
              )}
              <span className="truncate font-mono">{repo.fullName}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )

  function renderCommitsBody() {
    if (!selectedRepo) {
      return (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Select a repo to view commits
        </div>
      )
    }
    if (loadingCommits) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )
    }
    if (commitsError) {
      return (
        <div className="flex flex-1 items-center justify-center text-xs text-destructive px-4 text-center">
          {commitsError}
        </div>
      )
    }
    if (commits.length === 0) {
      return (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground px-4 text-center">
          No commits found for {selectedRepo}
        </div>
      )
    }

    const allSelected = selectedShas.size === commits.length

    return (
      <>
        <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground font-mono">
            {commits.length} commit{commits.length !== 1 ? 's' : ''}{' '}
            {dateFiltered ? `on ${snapshotDate.current}` : '(recent)'}
          </span>
          <button
            onClick={() =>
              setSelectedShas(allSelected ? new Set() : new Set(commits.map((c) => c.sha)))
            }
            className="text-xs text-accent hover:underline shrink-0 ml-2"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {groups.map(({ day, commits: dayCommits, shas: dayShas }) => {
            const allDaySelected = dayShas.every((s) => selectedShas.has(s))
            return (
              <div key={day}>
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{day}</span>
                  <button
                    onClick={() => toggleDay(dayShas)}
                    className="text-[10px] text-accent hover:underline shrink-0 ml-2"
                  >
                    {allDaySelected ? 'Deselect' : 'Select all'}
                  </button>
                </div>
                <div className="space-y-1">
                  {dayCommits.map((commit) => (
                    <label
                      key={commit.sha}
                      className={cn(
                        'flex items-start gap-2.5 rounded-md px-3 py-2.5 cursor-pointer transition hover:bg-surface/60',
                        selectedShas.has(commit.sha) && 'bg-accent/10'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedShas.has(commit.sha)}
                        onChange={() => toggleCommit(commit.sha)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-foreground leading-snug">{commit.message}</p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                          {commit.sha} · {commit.author}
                          {commit.date && (
                            <> · {new Date(commit.date).toLocaleString('en-IN', {
                              month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                              timeZone: 'Asia/Kolkata',
                            })}</>
                          )}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </>
    )
  }

  const commitsPanel = (
    <div className={cn(
      'flex-1 flex flex-col overflow-hidden min-w-0',
      mobilePanel === 'commits' ? 'flex w-full' : 'hidden sm:flex',
    )}>
      {selectedRepo && (
        <button
          onClick={() => setMobilePanel('repos')}
          className="sm:hidden flex items-center gap-1.5 px-4 py-2.5 text-xs text-muted-foreground border-b border-border hover:text-accent transition shrink-0"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="truncate font-mono">{selectedRepo}</span>
        </button>
      )}
      {renderCommitsBody()}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100%-2rem)] max-w-2xl rounded-lg p-0 gap-0 flex flex-col max-h-[88vh] sm:max-h-[80vh]">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle>Browse repos</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {repoListPanel}
          {commitsPanel}
        </div>

        <DialogFooter className="px-4 py-3 sm:px-5 sm:py-4 border-t border-border shrink-0 flex-row gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selectedRepo || commits.length === 0}
            onClick={handleLoad}
            className="flex-1 sm:flex-none gap-1.5 bg-accent text-accent-foreground hover:opacity-90"
          >
            <GitCommitHorizontal className="h-3.5 w-3.5" />
            Load {loadCount} commit{loadCount !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
