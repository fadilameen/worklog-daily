'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Loader2, Search, GitCommitHorizontal, Lock, Globe,
  ChevronLeft, GitBranch, ChevronDown, User, CheckSquare,
} from 'lucide-react'
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

interface CommitDisplay {
  commit: Commit
  subject: string
  body: string
  formattedDate: string
}

interface DayGroup {
  day: string
  items: CommitDisplay[]
  shas: string[]
}

interface FilterPopoverProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  activeCount: number
  items: string[]
  selected: string[]
  onToggle: (item: string) => void
  onOnly?: (item: string) => void
  onClear: () => void
  mono?: boolean
  extra?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function FilterPopover({
  icon: Icon, label, activeCount, items, selected, onToggle, onOnly, onClear, mono, extra, open, onOpenChange,
}: FilterPopoverProps) {
  const title = label.charAt(0).toUpperCase() + label.slice(1)
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors',
          activeCount > 0
            ? 'border-accent/50 bg-accent/10 text-accent'
            : 'border-border bg-surface/60 text-muted-foreground hover:text-foreground hover:border-border/80'
        )}>
          <Icon className="h-3 w-3 shrink-0" />
          <span className="font-medium">
            {activeCount > 0 ? `${activeCount} ${label}${activeCount > 1 ? 's' : ''}` : title}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="start">
        <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {title}s
        </p>
        <button
          onClick={onClear}
          className={cn(
            'w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors flex items-center gap-2',
            selected.length === 0 ? 'bg-accent/10 text-accent' : 'hover:bg-muted text-foreground'
          )}
        >
          <span className="h-3.5 w-3.5 rounded border border-current flex items-center justify-center shrink-0">
            {selected.length === 0 && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          All {label}s
        </button>
        <div className="my-1 border-t border-border" />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {items.map((item) => (
            <div key={item} className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
              <Checkbox
                checked={selected.includes(item)}
                onCheckedChange={() => onToggle(item)}
                className="h-3.5 w-3.5 shrink-0"
              />
              <span
                onClick={() => onToggle(item)}
                className={cn('text-xs truncate flex-1 cursor-pointer', mono && 'font-mono')}
              >
                {item}
              </span>
              {onOnly && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOnly(item) }}
                  className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity hover:underline shrink-0"
                >
                  Only
                </button>
              )}
            </div>
          ))}
        </div>
        {extra && (
          <>
            <div className="my-1 border-t border-border" />
            {extra}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLoad: (commits: string[], repo: string) => void
}

export function ManualRepoPicker({ open, onOpenChange, onLoad }: Props) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [reposError, setReposError] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [commitsError, setCommitsError] = useState('')
  const [loadingCommits, setLoadingCommits] = useState(false)
  const [selectedShas, setSelectedShas] = useState<Set<string>>(new Set())
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [pendingBranches, setPendingBranches] = useState<string[]>([])
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false)
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])
  const [customAuthorEnabled, setCustomAuthorEnabled] = useState(false)
  const [customAuthor, setCustomAuthor] = useState('')
  const [mobilePanel, setMobilePanel] = useState<'repos' | 'commits'>('repos')

  const branchCacheRef = useRef<Map<string, Commit[]>>(new Map())
  const branchesLoadedRef = useRef(false)

  useEffect(() => {
    if (!open || repos.length > 0) return
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

    const fetchBranch = async (b: string): Promise<Commit[]> => {
      const cached = branchCacheRef.current.get(b)
      if (cached) return cached
      const data = await fetch(
        `/api/github/repo-commits?repo=${encodeURIComponent(selectedRepo)}&branch=${encodeURIComponent(b)}`,
        { signal: controller.signal }
      )
        .then((r) => r.json())
        .then((d) => (Array.isArray(d.commits) ? d.commits : []) as Commit[])
        .catch((err) => {
          if (err.name === 'AbortError') throw err
          return [] as Commit[]
        })
      branchCacheRef.current.set(b, data)
      return data
    }

    const p: Promise<{ commits: Commit[]; branches?: string[] }> =
      selectedBranches.length > 0
        ? Promise.all(selectedBranches.map(fetchBranch)).then((results) => {
            const seen = new Set<string>()
            const merged: Commit[] = []
            for (const list of results) {
              for (const c of list) {
                if (!seen.has(c.sha)) { seen.add(c.sha); merged.push(c) }
              }
            }
            merged.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
            return { commits: merged }
          })
        : fetch(`/api/github/repo-commits?repo=${encodeURIComponent(selectedRepo)}`, { signal: controller.signal })
            .then((r) => r.json())

    p.then((data) => {
      setCommits(data.commits || [])
      if (!branchesLoadedRef.current && data.branches?.length) {
        branchesLoadedRef.current = true
        setBranches(data.branches)
      }
    })
      .catch((err) => { if (err.name !== 'AbortError') setCommitsError('Failed to load commits') })
      .finally(() => setLoadingCommits(false))

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo, selectedBranches])

  const filteredRepos = useMemo(() => {
    const q = repoSearch.toLowerCase()
    if (!q) return repos
    return repos.filter((r) => r.fullName.toLowerCase().includes(q))
  }, [repos, repoSearch])

  const authors = useMemo(
    () => [...new Set(commits.map((c) => c.author).filter(Boolean))].sort(),
    [commits]
  )

  const visibleCommits = useMemo(() => {
    const custom = customAuthorEnabled ? customAuthor.trim().toLowerCase() : ''
    if (selectedAuthors.length === 0 && !custom) return commits
    const normalizedAuthors = selectedAuthors.map((x) => x.toLowerCase())
    return commits.filter((c) => {
      const a = c.author.toLowerCase()
      return normalizedAuthors.some((x) => a === x) || (custom && a.includes(custom))
    })
  }, [commits, selectedAuthors, customAuthorEnabled, customAuthor])

  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, CommitDisplay[]>()
    for (const c of visibleCommits) {
      const d = c.date ? new Date(c.date) : null
      const day = d
        ? d.toLocaleDateString('en-IN', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            timeZone: 'Asia/Kolkata',
          })
        : 'Unknown date'
      const [subject, ...bodyLines] = c.message.split('\n')
      const body = bodyLines.join(' ').trim()
      const formattedDate = d
        ? d.toLocaleString('en-IN', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
            timeZone: 'Asia/Kolkata',
          })
        : ''
      const arr = map.get(day)
      const entry: CommitDisplay = { commit: c, subject, body, formattedDate }
      if (arr) arr.push(entry)
      else map.set(day, [entry])
    }
    return Array.from(map.entries()).map(([day, items]) => ({
      day, items, shas: items.map((i) => i.commit.sha),
    }))
  }, [visibleCommits])

  const allSelected = useMemo(
    () => visibleCommits.length > 0 && visibleCommits.every((c) => selectedShas.has(c.sha)),
    [visibleCommits, selectedShas]
  )

  const toggleCommit = useCallback((sha: string) => {
    setSelectedShas((prev) => {
      const next = new Set(prev)
      if (next.has(sha)) next.delete(sha)
      else next.add(sha)
      return next
    })
  }, [])

  const toggleDay = useCallback((dayShas: string[]) => {
    setSelectedShas((prev) => {
      const allDaySelected = dayShas.every((s) => prev.has(s))
      const next = new Set(prev)
      if (allDaySelected) dayShas.forEach((s) => next.delete(s))
      else dayShas.forEach((s) => next.add(s))
      return next
    })
  }, [])

  const toggleBranch = useCallback((b: string) =>
    setPendingBranches((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    ), [])

  const toggleAuthor = useCallback((a: string) =>
    setSelectedAuthors((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    ), [])

  const handleSelectRepo = useCallback((fullName: string) => {
    setSelectedRepo(fullName)
    setSelectedBranches([])
    setPendingBranches([])
    setBranchPopoverOpen(false)
    setBranches([])
    setSelectedAuthors([])
    setCustomAuthorEnabled(false)
    setCustomAuthor('')
    setMobilePanel('commits')
    branchCacheRef.current.clear()
    branchesLoadedRef.current = false
  }, [])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    setSelectedRepo(null)
    setCommits([])
    setCommitsError('')
    setSelectedShas(new Set())
    setBranches([])
    setSelectedBranches([])
    setPendingBranches([])
    setBranchPopoverOpen(false)
    setSelectedAuthors([])
    setCustomAuthorEnabled(false)
    setCustomAuthor('')
    setRepoSearch('')
    setMobilePanel('repos')
    branchCacheRef.current.clear()
    branchesLoadedRef.current = false
  }, [onOpenChange])

  const handleLoad = useCallback(() => {
    if (!selectedRepo) return
    const selected = visibleCommits.filter((c) => selectedShas.has(c.sha))
    const messages = selected.length > 0 ? selected.map((c) => c.message) : visibleCommits.map((c) => c.message)
    onLoad(messages, selectedRepo)
    handleClose()
  }, [selectedRepo, visibleCommits, selectedShas, onLoad, handleClose])

  const loadCount = selectedShas.size || visibleCommits.length

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100%-2rem)] max-w-2xl rounded-xl p-0 gap-0 flex flex-col max-h-[88vh] sm:max-h-[82vh] overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3.5 border-b border-border shrink-0">
          <DialogTitle className="text-base">Browse repos</DialogTitle>
          {selectedRepo && (
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{selectedRepo}</p>
          )}
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className={cn(
            'flex flex-col overflow-hidden',
            'sm:w-64 sm:shrink-0 sm:border-r sm:border-border',
            mobilePanel === 'repos' ? 'flex w-full' : 'hidden sm:flex',
          )}>
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search repos…"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-surface/60"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingRepos ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : reposError ? (
                <p className="px-3 py-4 text-xs text-destructive">{reposError}</p>
              ) : filteredRepos.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">No repos found</p>
              ) : (
                filteredRepos.map((repo) => (
                  <button
                    key={repo.fullName}
                    onClick={() => handleSelectRepo(repo.fullName)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors',
                      selectedRepo === repo.fullName
                        ? 'bg-accent/10 text-accent border-r-2 border-accent'
                        : 'hover:bg-surface/80 text-foreground/80'
                    )}
                  >
                    {repo.private ? (
                      <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-mono text-[11px]">{repo.fullName}</span>
                  </button>
                ))
              )}
            </div>
          </div>

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

            {!selectedRepo ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                <GitBranch className="h-8 w-8 opacity-20" />
                <p className="text-xs">Select a repo to view commits</p>
              </div>
            ) : loadingCommits ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : commitsError ? (
              <div className="flex flex-1 items-center justify-center text-xs text-destructive px-4 text-center">
                {commitsError}
              </div>
            ) : commits.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground px-4 text-center">
                <GitCommitHorizontal className="h-8 w-8 opacity-20" />
                <p className="text-xs">No commits found for <span className="font-mono">{selectedRepo}</span></p>
              </div>
            ) : visibleCommits.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground px-4 text-center">
                <Search className="h-8 w-8 opacity-20" />
                <p className="text-xs">No commits match the selected filters</p>
              </div>
            ) : (
              <>
                <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0 bg-surface/40">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                    {branches.length > 0 && (
                      <FilterPopover
                        icon={GitBranch}
                        label="branch"
                        activeCount={selectedBranches.length}
                        items={branches}
                        selected={pendingBranches}
                        onToggle={toggleBranch}
                        onOnly={(b) => { setPendingBranches([b]); setSelectedBranches([b]); setBranchPopoverOpen(false) }}
                        onClear={() => { setPendingBranches([]); setSelectedBranches([]) }}
                        open={branchPopoverOpen}
                        onOpenChange={(open) => {
                          if (open) setPendingBranches(selectedBranches)
                          setBranchPopoverOpen(open)
                        }}
                        mono
                        extra={
                          <div className="px-2 py-1.5">
                            <Button
                              size="sm"
                              onClick={() => { setSelectedBranches(pendingBranches); setBranchPopoverOpen(false) }}
                              className="w-full h-7 text-xs bg-accent text-accent-foreground hover:opacity-90"
                            >
                              Apply
                            </Button>
                          </div>
                        }
                      />
                    )}
                    {authors.length > 0 && (
                      <FilterPopover
                        icon={User}
                        label="author"
                        activeCount={selectedAuthors.length + (customAuthorEnabled ? 1 : 0)}
                        items={authors}
                        selected={selectedAuthors}
                        onToggle={toggleAuthor}
                        onOnly={(a) => setSelectedAuthors([a])}
                        onClear={() => { setSelectedAuthors([]); setCustomAuthorEnabled(false); setCustomAuthor('') }}
                        extra={
                          <>
                            <label className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors">
                              <Checkbox
                                checked={customAuthorEnabled}
                                onCheckedChange={(v) => setCustomAuthorEnabled(!!v)}
                                className="h-3.5 w-3.5 shrink-0"
                              />
                              <span className="text-xs text-muted-foreground">Custom…</span>
                            </label>
                            {customAuthorEnabled && (
                              <div className="px-2 pt-1 pb-1">
                                <Input
                                  value={customAuthor}
                                  onChange={(e) => setCustomAuthor(e.target.value)}
                                  placeholder="Type name…"
                                  autoFocus
                                  className="h-7 text-xs"
                                />
                              </div>
                            )}
                          </>
                        }
                      />
                    )}
                    {(selectedBranches.length > 0 || selectedAuthors.length > 0 || customAuthorEnabled) && (
                      <button
                        onClick={() => {
                          setSelectedBranches([])
                          setPendingBranches([])
                          setBranchPopoverOpen(false)
                          setSelectedAuthors([])
                          setCustomAuthorEnabled(false)
                          setCustomAuthor('')
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {visibleCommits.length} commit{visibleCommits.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() =>
                        setSelectedShas(allSelected ? new Set() : new Set(visibleCommits.map((c) => c.sha)))
                      }
                      className="flex items-center gap-1 text-[11px] text-accent hover:underline"
                    >
                      <CheckSquare className="h-3 w-3" />
                      {allSelected ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {groups.map(({ day, items, shas: dayShas }) => {
                    const allDaySelected = dayShas.every((s) => selectedShas.has(s))
                    return (
                      <div key={day}>
                        <div className="flex items-center justify-between px-4 py-2 sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/50 z-10">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{day}</span>
                          <button
                            onClick={() => toggleDay(dayShas)}
                            className="text-[10px] text-accent hover:underline"
                          >
                            {allDaySelected ? 'Deselect' : 'Select all'}
                          </button>
                        </div>
                        <div className="p-2 space-y-0.5">
                          {items.map(({ commit, subject, body, formattedDate }) => (
                            <label
                              key={commit.sha}
                              className={cn(
                                'flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors',
                                selectedShas.has(commit.sha)
                                  ? 'bg-accent/10 ring-1 ring-accent/20'
                                  : 'hover:bg-surface/80'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectedShas.has(commit.sha)}
                                onChange={() => toggleCommit(commit.sha)}
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-foreground leading-snug font-medium">{subject}</p>
                                {body && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                                    {body}
                                  </p>
                                )}
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="font-mono text-[10px] text-muted-foreground bg-surface/80 px-1.5 py-0.5 rounded">{commit.sha}</span>
                                  <span className="text-[10px] text-muted-foreground">{commit.author}</span>
                                  {formattedDate && (
                                    <span className="text-[10px] text-muted-foreground">{formattedDate}</span>
                                  )}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="px-4 py-3 sm:px-5 border-t border-border shrink-0 flex-row gap-2 bg-surface/40">
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
            {selectedShas.size > 0 && <span className="opacity-70 text-[10px]">selected</span>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
