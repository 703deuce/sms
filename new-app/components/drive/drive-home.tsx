'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Clapperboard,
  Copy,
  FolderOpen,
  LayoutGrid,
  List,
  Radio,
  Upload,
} from 'lucide-react'
import { useClipsDriveOptional } from '@/components/drive/clips-drive-context'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProjectGrid } from '@/components/clips/project-card'
import { MoveToFolderDialog } from '@/components/drive/move-to-folder-dialog'
import { NewFolderDialog } from '@/components/drive/new-folder-dialog'
import { ProjectRowMenu } from '@/components/drive/project-row-menu'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { attachMediaToProject, clipsFetch, createProject, createProjectFromPrompt } from '@/lib/clips-api'
import { defaultClipSettings, TOOL_PRESET_MAP } from '@/lib/clips/settings'
import { uploadClipFile } from '@/lib/clips/upload'
import { cn } from '@/lib/utils'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'

const TEMPLATE_CHIPS: { label: string; preset: string }[] = [
  { label: 'Turn a long video into clips', preset: 'long-video-to-short-video' },
  { label: 'Clean up video recording', preset: 'auto-reframe-video' },
  { label: 'Create social clips', preset: 'ai-clip-maker' },
  { label: 'Transcribe', preset: 'add-captions-to-video' },
  { label: 'Rough cut of podcast', preset: 'podcast-to-shorts' },
]

export function DriveHome({
  initialProjects,
  q,
  status: statusFilter,
  pageView = 'home',
  folders = [],
  showAll = false,
}: {
  initialProjects: ClipProjectListItem[]
  q?: string
  status?: string
  pageView?: 'home' | 'trash' | 'recents'
  folders?: { id: string; name: string }[]
  showAll?: boolean
}) {
  const router = useRouter()
  const drive = useClipsDriveOptional()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [localSearch, setLocalSearch] = useState(q ?? '')
  const [status, setStatus] = useState(statusFilter ?? 'all')
  const search = drive?.search ?? localSearch
  const setSearch = drive?.setSearch ?? setLocalSearch
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [heroBusy, setHeroBusy] = useState(false)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)

  const projects = initialProjects

  useEffect(() => {
    if (q != null && drive) drive.setSearch(q)
  }, [q, drive])

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const onSearch = useCallback(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (status && status !== 'all') params.set('status', status)
    if (showAll) params.set('view', 'all')
    router.push(`/app/clips?${params.toString()}`)
  }, [router, search, status, showAll])

  const bulkMove = async (folderId: string | null) => {
    if (!selected.size) return
    await clipsFetch('/api/clips/projects/bulk', {
      method: 'POST',
      body: JSON.stringify({
        action: 'move',
        projectIds: [...selected],
        folderId,
      }),
    })
    setSelected(new Set())
    router.refresh()
  }

  const bulkAction = async (action: 'trash' | 'restore' | 'duplicate' | 'move') => {
    if (!selected.size) return
    if (action === 'move') {
      setBulkMoveOpen(true)
      return
    } else {
      await clipsFetch('/api/clips/projects/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: pageView === 'trash' && action === 'trash' ? 'restore' : action,
          projectIds: [...selected],
        }),
      })
    }
    setSelected(new Set())
    router.refresh()
  }

  const startFromFile = async (file: File) => {
    setHeroBusy(true)
    drive?.setTranscribingTitle(file.name)
    drive?.setTranscribingOpen(true)
    drive?.setSyncing(true)
    try {
      const uploadId = await new Promise<string>((resolve, reject) => {
        void uploadClipFile(file, (p) => {
          if (p.state === 'complete' && p.uploadId) resolve(p.uploadId)
          if (p.state === 'error') reject(new Error(p.error ?? 'Upload failed'))
        }).catch(reject)
      })
      const settings = defaultClipSettings(
        prompt.trim() ? { prompt: prompt.trim() } : undefined,
      )
      const project = await createProject({ uploadId, settings, title: prompt.trim() || undefined })
      router.push(`/app/clips/${project.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start project')
      drive?.setTranscribingOpen(false)
    } finally {
      setHeroBusy(false)
      drive?.setSyncing(false)
    }
  }

  const startFromPrompt = async () => {
    const text = prompt.trim()
    if (!text) return
    setHeroBusy(true)
    try {
      const project = await createProjectFromPrompt({ prompt: text })
      router.push(`/app/clips/${project.id}/script`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create project')
    } finally {
      setHeroBusy(false)
    }
  }

  const onHeroSubmit = () => {
    if (fileInputRef.current?.files?.[0]) {
      void startFromFile(fileInputRef.current.files[0])
      return
    }
    void startFromPrompt()
  }

  const openPreset = (presetKey: string) => {
    const overrides = TOOL_PRESET_MAP[presetKey]
    if (!overrides) {
      router.push('/app/clips/new')
      return
    }
    router.push(`/app/clips/new?preset=${encodeURIComponent(presetKey)}`)
  }

  return (
    <div
      className={cn(
        'mx-auto max-w-[1188px] rounded-xl border border-border bg-card p-6 md:p-12',
        dragOver && 'border-2 border-dashed border-primary bg-primary/5',
      )}
      data-testid="drive-home"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) void startFromFile(file)
      }}
    >
      {dragOver && (
        <p className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center text-base font-semibold">
          Drop to upload and create a project
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        {pageView !== 'trash' && <NewFolderDialog variant="toolbar" />}
        <Link href="/app/rooms/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <span className="mr-1 inline-block size-2 rounded-full bg-lane-record" />
          Record
        </Link>
        {isT2vFeatureEnabled() ? (
          <Link href="/app/clips/video/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Clapperboard className="mr-1 size-4" />
            Text to video
          </Link>
        ) : null}
        <PrimaryButton render={<Link href="/app/clips/new" />} className="h-8 px-3 text-sm">
          New project
        </PrimaryButton>
      </div>

      <div className="mx-auto max-w-[800px] text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {pageView === 'trash' ? 'Trash' : 'What do you want to make?'}
        </h1>
        <div className="mt-6 rounded-xl border border-input bg-card p-4 text-left">
          <textarea
            className="min-h-[72px] w-full resize-none bg-transparent text-[15px] outline-none"
            placeholder="Upload a file or describe what you want to make…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            data-testid="drive-hero-prompt"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void startFromFile(file)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
            </Button>
            <PrimaryButton className="h-8" disabled={heroBusy || !prompt.trim()} onClick={() => onHeroSubmit()}>
              {heroBusy ? 'Starting…' : 'Get started'}
            </PrimaryButton>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {TEMPLATE_CHIPS.map((chip) => (
            <button
              key={chip.preset}
              type="button"
              className="h-8 rounded-full border border-border px-3 text-[13px] hover:bg-accent"
              onClick={() => openPreset(chip.preset)}
              data-testid={`drive-chip-${chip.preset}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {!drive && (
            <Input
              className="h-8 min-w-[200px] max-w-md flex-1"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
          )}
          <Select value={status} onValueChange={(v) => v && setStatus(v)}>
            <SelectTrigger className="h-8 w-[140px]" data-testid="drive-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={onSearch}>Search</Button>
          <div className="ml-auto flex gap-1">
            <Button type="button" variant={layout === 'grid' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setLayout('grid')} aria-label="Grid view">
              <LayoutGrid className="size-4" />
            </Button>
            <Button type="button" variant={layout === 'list' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setLayout('list')} aria-label="List view">
              <List className="size-4" />
            </Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
            <span>{selected.size} selected</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void bulkAction(pageView === 'trash' ? 'restore' : 'trash')}>
              {pageView === 'trash' ? 'Restore' : 'Delete'}
            </Button>
            {pageView !== 'trash' && (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => void bulkAction('duplicate')}>
                  <Copy className="mr-1 size-3.5" />
                  Duplicate
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void bulkAction('move')}>
                  Move
                </Button>
              </>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>×</Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {pageView === 'trash' ? 'Deleted projects' : showAll ? 'All projects' : 'Recent projects'}
          </h2>
          {!showAll && pageView !== 'trash' && (
            <Link href="/app/clips?view=all" className={buttonVariants({ variant: 'outline', size: 'sm' })} data-testid="view-all-projects">
              View all projects
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="mx-auto mt-12 flex max-w-[320px] flex-col items-center gap-3 text-center">
            <FolderOpen className="size-8 text-muted-foreground" />
            <p className="text-sm font-semibold">No projects yet</p>
            <p className="text-xs text-muted-foreground">Upload a video or start recording.</p>
            <div className="flex gap-2">
              <PrimaryButton render={<Link href="/app/clips/new" />}>New project</PrimaryButton>
              <Link href="/app/rooms/new" className={buttonVariants({ variant: 'outline' })}>
                <Radio className="size-4" />
                Record
              </Link>
            </div>
          </div>
        ) : layout === 'grid' ? (
          <div className="mt-4">
            <ProjectGrid
              projects={projects}
              selectedIds={selected}
              onToggleSelect={toggleSelect}
              selectionMode={selected.size > 0}
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="h-8 border-b border-border text-xs text-muted-foreground">
                  <th className="w-8 px-2" scope="col" />
                  <th scope="col">Name</th>
                  <th className="w-28 px-2" scope="col">Owner</th>
                  <th className="w-28 px-2" scope="col">Created</th>
                  <th className="w-28 px-2" scope="col">Published</th>
                  <th className="w-10 px-2" scope="col" />
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="h-10 border-b border-border/60 hover:bg-accent/40">
                    <td className="px-2">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        aria-label={`Select ${p.title}`}
                      />
                    </td>
                    <td className="px-2">
                      <Link href={`/app/clips/${p.id}`} className="font-medium hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-2 text-xs text-muted-foreground">{p.ownerName ?? '—'}</td>
                    <td className="px-2 text-xs text-muted-foreground" title={new Date(p.createdAt).toLocaleString()}>
                      {formatRelativeTime(
                        typeof p.createdAt === 'string' ? p.createdAt : new Date(p.createdAt).toISOString(),
                      )}
                    </td>
                    <td className="px-2 text-xs text-muted-foreground">
                      {p.publishedAt
                        ? formatRelativeTime(p.publishedAt)
                        : p.isPublished
                          ? 'Yes'
                          : '—'}
                    </td>
                    <td className="px-2">
                      <ProjectRowMenu projectId={p.id} title={p.title} folders={folders} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { title: 'AI video maker', body: 'Turn long recordings into short clips.', icon: Clapperboard },
          { title: 'Transcribe', body: 'Edit video by editing text.', icon: List },
          { title: 'Record', body: 'Capture camera or screen in Rooms.', icon: Radio },
        ].map((card) => (
          <div key={card.title} className="surface rounded-xl border border-border p-4">
            <card.icon className="mb-2 size-5 text-muted-foreground" />
            <p className="text-sm font-semibold">{card.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.body}</p>
          </div>
        ))}
      </div>

      <MoveToFolderDialog
        open={bulkMoveOpen}
        onOpenChange={setBulkMoveOpen}
        folders={folders}
        onSelect={(folderId) => bulkMove(folderId)}
        title="Move selected projects"
      />
    </div>
  )
}
