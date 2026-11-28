'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Folder, Monitor, Phone, Plug, RefreshCw, ShieldCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { formatWhen } from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'
import { OpsCard, OpsEmpty, OpsError, OpsLoading, OpsPage, SectionHeading } from './ops-ui'
import { useOverview, usePolled } from './use-ops-data'

// ---------------- Calls ----------------

export function CallsPage() {
  return (
    <OpsPage icon={Phone} title="Calls" description="Your AI receptionist's calls: who called, a summary or transcript, and how each call ended.">
      <OpsEmpty
        icon={Phone}
        title="No calls to show yet"
        description="When your agent answers or returns calls, each one will appear here with the caller, a summary and the outcome."
        action={
          <Link href="/app/agent-lab" className={buttonVariants({ variant: 'outline' })}>
            Set up calls in chat
          </Link>
        }
      />
    </OpsPage>
  )
}

// ---------------- Permissions ----------------

export function PermissionsPage() {
  return (
    <OpsPage
      icon={ShieldCheck}
      title="Permissions"
      description="What your agent is allowed to do on its own, and the limits you've set. Separate from your responsibilities and from approval history."
    >
      <OpsEmpty
        icon={ShieldCheck}
        title="No standing permissions yet"
        description="When you let your agent act on its own, for example spend up to $25 per change and $100 a month on an ad campaign, the permission and how much of each limit is used will show here, ready to revoke."
        action={
          <>
            <Link href="/app/agent-lab" className={buttonVariants({ variant: 'default' })}>
              Grant one in chat
            </Link>
            <Link href="/app/agent-lab/connections" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
              <Plug className="size-4" />
              Connections
            </Link>
          </>
        }
      />
    </OpsPage>
  )
}

// ---------------- Computer ----------------

type DesktopStatus = { status?: string | null; message?: string | null; kind?: string | null; error?: string | null }

export function ComputerPage() {
  const { data, error } = usePolled<DesktopStatus>('/api/agent-lab/desktop/status', 10_000)
  const [tick, setTick] = useState(0)
  const [imgFailed, setImgFailed] = useState(false)
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1)
    }, 3000)
    return () => clearInterval(t)
  }, [])
  return (
    <OpsPage icon={Monitor} title="Computer" description="Watch your agent's own computer while it works. To take control, ask in chat and you'll get a live session.">
      {imgFailed ? (
        <OpsEmpty icon={Monitor} title="The screen isn't live right now" description="It appears here while your agent is using its browser or desktop." />
      ) : (
        <OpsCard className="overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/agent-lab/desktop/live?t=${tick}`}
            alt="Your agent's screen"
            className="block aspect-video w-full bg-muted object-contain"
            onError={() => setImgFailed(true)}
            onLoad={() => setImgFailed(false)}
          />
        </OpsCard>
      )}
      {(data?.message || error) && <p className="text-xs text-muted-foreground">{data?.message || 'Status unavailable right now.'}</p>}
    </OpsPage>
  )
}

// ---------------- Files ----------------

type FileEntry = { path: string; name: string; size: number; modifiedAt: string }

function size(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function FilesPage() {
  const { data, error: ovErr, reload: reloadOv } = useOverview()
  const [files, setFiles] = useState<(FileEntry & { task: string })[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const runs = data?.runs
  const load = useCallback(async () => {
    if (!runs) return
    const seen = new Set<string>()
    const convs: { id: string; task: string }[] = []
    for (const r of runs) {
      if (r.helper || !r.conversationId || seen.has(r.conversationId)) continue
      seen.add(r.conversationId)
      convs.push({ id: r.conversationId, task: r.title || 'Task' })
      if (convs.length >= 8) break
    }
    setBusy(true)
    try {
      const lists = await Promise.all(
        convs.map(async (c) => {
          const res = await fetch(`/api/agent-lab/files?conversation=${encodeURIComponent(c.id)}`, { cache: 'no-store' })
          if (!res.ok) return []
          const body = (await res.json().catch(() => ({ files: [] }))) as { files?: FileEntry[] }
          return (body.files ?? []).map((f) => ({ ...f, task: c.task }))
        }),
      )
      setFiles(lists.flat().sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 200))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load files')
    } finally {
      setBusy(false)
    }
  }, [runs])

  useEffect(() => {
    if (runs && files === null) void load()
  }, [runs, files, load])

  return (
    <OpsPage
      icon={Folder}
      title="Files"
      description="Everything your agent made for you across recent tasks: reports, sheets, decks, images and drafts."
      actions={
        <button type="button" onClick={() => void load()} disabled={busy} className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
          <RefreshCw className={cn('size-4', busy && 'animate-spin')} />
          Refresh
        </button>
      }
    >
      {(ovErr && !data) || error ? <OpsError message={error ?? ovErr ?? ''} onRetry={() => (data ? void load() : reloadOv())} /> : null}
      {files === null ? (
        <OpsLoading />
      ) : files.length === 0 ? (
        <OpsEmpty icon={FileText} title="No files yet" description="Files your agent saves for you will collect here." />
      ) : (
        <section className="flex flex-col gap-3">
          <SectionHeading title="Recent files" count={files.length} />
          <OpsCard className="p-0">
            <ul className="divide-y divide-border">
              {files.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <a href={`/api/agent-lab/file?path=${encodeURIComponent(f.path)}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">
                        {f.name}
                      </a>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.task} · {formatWhen(f.modifiedAt)} · {size(f.size)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/api/agent-lab/file?path=${encodeURIComponent(f.path)}&download=1`}
                    aria-label={`Download ${f.name}`}
                    className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                  >
                    <Download />
                  </a>
                </li>
              ))}
            </ul>
          </OpsCard>
        </section>
      )}
    </OpsPage>
  )
}
