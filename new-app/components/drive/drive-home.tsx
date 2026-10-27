'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import {
  Clapperboard,
  FolderOpen,
  LayoutGrid,
  List,
  Plus,
  Radio,
  Search,
  Upload,
} from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProjectGrid } from '@/components/clips/project-card'
import { ProjectRowMenu } from '@/components/drive/project-row-menu'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'
import { clipsFetch } from '@/lib/clips-api'
import { cn } from '@/lib/utils'

const TEMPLATE_CHIPS = [
  'Turn a long video into clips',
  'Clean up video recording',
  'Create social clips',
  'Transcribe',
  'Rough cut of podcast',
]

export function DriveHome({
  initialProjects,
  q,
  status,
  view = 'home',
  folders = [],
}: {
  initialProjects: ClipProjectListItem[]
  q?: string
  status?: string
  view?: 'home' | 'trash' | 'recents'
  folders?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState(q ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [prompt, setPrompt] = useState('')

  const projects = initialProjects

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
    router.push(`/app/clips?${params.toString()}`)
  }, [router, search, status])

  const bulkTrash = async () => {
    if (!selected.size) return
    await clipsFetch('/api/clips/projects/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: view === 'trash' ? 'restore' : 'trash', projectIds: [...selected] }),
    })
    setSelected(new Set())
    router.refresh()
  }

  const createFolder = async () => {
    const name = window.prompt('Folder name')
    if (!name?.trim()) return
    await clipsFetch('/api/clips/folders', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
    router.refresh()
  }

  const heroDisabled = !prompt.trim()

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
        router.push('/app/clips/new')
      }}
    >
      {dragOver && (
        <p className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center text-base font-semibold">
          Drop to create a project
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        {view !== 'trash' && (
          <Button type="button" variant="outline" size="sm" onClick={() => void createFolder()}>
            <FolderOpen className="mr-1 size-4" />
            New folder
          </Button>
        )}
        <Link href="/app/rooms/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <span className="mr-1 inline-block size-2 rounded-full bg-lane-record" />
          Record
        </Link>
        <PrimaryButton render={<Link href="/app/clips/new" />} className="h-8 px-3 text-sm">
          New project
        </PrimaryButton>
      </div>

      <div className="mx-auto max-w-[800px] text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {view === 'trash' ? 'Trash' : 'What do you want to make?'}
        </h1>
        <div className="mt-6 rounded-xl border border-input bg-card p-4 text-left">
          <textarea
            className="min-h-[72px] w-full resize-none bg-transparent text-[15px] outline-none"
            placeholder="Upload a file or describe what you want to make…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach" onClick={() => router.push('/app/clips/new')}>
              <Upload className="size-4" />
            </Button>
            <PrimaryButton
              className="h-8"
              disabled={heroDisabled}
              onClick={() => router.push('/app/clips/new')}
            >
              Get started
            </PrimaryButton>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {TEMPLATE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="h-8 rounded-full border border-border px-3 text-[13px] hover:bg-accent"
              onClick={() => router.push(chip.includes('clips') ? '/app/clips/new' : '/app/clips/new')}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="h-8 pl-9"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onSearch}>Search</Button>
          <div className="ml-auto flex gap-1">
            <Button type="button" variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setView('grid')} aria-label="Grid view">
              <LayoutGrid className="size-4" />
            </Button>
            <Button type="button" variant={view === 'list' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setView('list')} aria-label="List view">
              <List className="size-4" />
            </Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
            <span>{selected.size} selected</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void bulkTrash()}>
              {view === 'trash' ? 'Restore' : 'Delete'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>×</Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{view === 'trash' ? 'Deleted projects' : 'Recent projects'}</h2>
          <Link href="/app/clips?view=all" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            View all projects
          </Link>
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
        ) : view === 'grid' ? (
          <div className="mt-4">
            <ProjectGrid projects={projects} />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="h-8 border-b border-border text-xs text-muted-foreground">
                  <th className="w-8 px-2" scope="col" />
                  <th scope="col">Name</th>
                  <th className="w-24 px-2" scope="col">Duration</th>
                  <th className="w-20 px-2" scope="col">Clips</th>
                  <th className="w-28 px-2" scope="col">Last viewed</th>
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
                    <td className="px-2 font-mono text-xs tabular-nums">
                      {Math.round(p.durationMs / 1000)}s
                    </td>
                    <td className="px-2">{p.clipCount}</td>
                    <td className="px-2 text-xs text-muted-foreground">
                      {p.lastViewedAt ? new Date(p.lastViewedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-2">
                      <ProjectRowMenu projectId={p.id} title={p.title} />
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
    </div>
  )
}
