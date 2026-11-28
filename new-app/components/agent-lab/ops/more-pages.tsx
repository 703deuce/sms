'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Download, FileText, Folder, Monitor, Phone, RefreshCw, ShieldCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { formatWhen } from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'
import { MODE_LABEL, fromUnix, gbPost, gbUrl, money, type Call, type HistoryRow, type Mode, type PermissionsDoc, type SpendSummary } from './gb14'
import { OpsCard, OpsEmpty, OpsError, OpsLoading, OpsPage, Pill, SectionHeading } from './ops-ui'
import { useOverview, usePolled } from './use-ops-data'

// ---------------- Calls ----------------

function duration(s: number | null | undefined): string {
  if (!s) return 'Missed'
  const m = Math.floor(s / 60)
  return m ? `${m} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`
}

export function CallsPage() {
  const { data, error, loading, reload } = usePolled<{ items: Call[]; source_note?: string }>(gbUrl('calls'), 30_000)
  const [open, setOpen] = useState<string | null>(null)
  const items = data?.items ?? []
  return (
    <OpsPage icon={Phone} title="Calls" description="Your AI receptionist's calls: who called, a summary or transcript, and how each call ended.">
      {loading && !data ? (
        <OpsLoading />
      ) : items.length === 0 ? (
        <OpsEmpty
          icon={Phone}
          title="No calls to show yet"
          description={
            error
              ? 'Call history is starting up. Check back in a few minutes.'
              : 'When your agent answers or returns calls, each one will appear here with the caller, a summary and the outcome.'
          }
          action={
            <>
              <Link href="/app/agent-lab" className={buttonVariants({ variant: 'outline' })}>
                Set up calls in chat
              </Link>
              {error && (
                <button type="button" onClick={reload} className={buttonVariants({ variant: 'ghost' })}>
                  Try again
                </button>
              )}
            </>
          }
        />
      ) : (
        <OpsCard className="p-0">
          <ul className="divide-y divide-border">
            {items.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.caller || 'Unknown caller'}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {formatWhen(fromUnix(c.at))} · {duration(c.duration_s)}
                      {c.summary ? ` · ${c.summary}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {c.booked && <Pill tone="success">Booked</Pill>}
                    {c.texts_sent ? <Pill tone="info">Texted back</Pill> : null}
                    {c.needs_you && <Pill tone="warning">Needs you</Pill>}
                  </div>
                </button>
                {open === c.id && (
                  <div className="flex flex-col gap-2 px-4 pb-3 text-sm">
                    {c.summary && <p>{c.summary}</p>}
                    {c.transcript ? (
                      <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 font-sans text-xs whitespace-pre-wrap text-muted-foreground">{c.transcript}</pre>
                    ) : (
                      <p className="text-xs text-muted-foreground">No transcript for this call.</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </OpsCard>
      )}
    </OpsPage>
  )
}

// ---------------- Permissions ----------------

const MODES: Mode[] = ['supervised', 'selective', 'full']

function ModePicker({ value, onChange, allowInherit, disabled }: { value: Mode | null; onChange: (m: Mode | '') => void; allowInherit?: boolean; disabled?: boolean }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-0.5">
      {allowInherit && (
        <button type="button" disabled={disabled} onClick={() => onChange('')} className={cn('rounded-md px-2.5 py-1 text-xs font-medium', value === null ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
          Default
        </button>
      )}
      {MODES.map((m) => (
        <button key={m} type="button" disabled={disabled} onClick={() => onChange(m)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium', value === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  )
}

function SpendCard({ s, onRevoke, busy }: { s: SpendSummary; onRevoke: () => void; busy: boolean }) {
  const cur = s.limit.currency || 'USD'
  const max = s.limit.period_max ?? null
  const used = s.used ?? 0
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0
  return (
    <OpsCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{s.limit.label || s.limit.target || 'Spending limit'}</p>
          <p className="text-xs text-muted-foreground">
            {s.limit.app}
            {s.limit.per_action_max ? ` · ${money(s.limit.per_action_max, cur)} per action` : ''}
            {max ? ` · ${money(max, cur)} per ${s.limit.period || 'month'}` : ''}
          </p>
        </div>
        <button type="button" disabled={busy} onClick={onRevoke} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
          Revoke
        </button>
      </div>
      {max ? (
        <div>
          <p className="text-sm font-medium">
            Used {money(used, cur)} of {money(max, cur)}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Pending</dt>
          <dd className="mt-0.5 font-medium">{money(s.pending_changes, cur)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Authorized</dt>
          <dd className="mt-0.5 font-medium">{money(s.authorized_budget, cur)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Actual spend</dt>
          <dd className="mt-0.5 font-medium">{money(s.actual_spend, cur)}</dd>
        </div>
      </dl>
    </OpsCard>
  )
}

export function PermissionsPage() {
  const perms = usePolled<PermissionsDoc>(gbUrl('permissions'), 30_000)
  const hist = usePolled<{ items: HistoryRow[] }>(gbUrl('permissions/history?limit=50'), 60_000)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const d = perms.data

  async function act(path: string, body: unknown) {
    setBusy(true)
    setErr(null)
    try {
      await gbPost(path, body)
      perms.reload()
      hist.reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That change did not go through')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OpsPage
      icon={ShieldCheck}
      title="Permissions"
      description="What your agent may do on its own and the limits you've set. Anything inside these runs without asking. Separate from your responsibilities."
      actions={
        d && d.pending_approvals > 0 ? (
          <Link href="/app/agent-lab/needs-you" className={buttonVariants({ variant: 'outline' })}>
            {d.pending_approvals} waiting for you
          </Link>
        ) : null
      }
    >
      {err && <OpsError message={err} />}
      {perms.loading && !d ? (
        <OpsLoading />
      ) : !d ? (
        <OpsEmpty
          icon={ShieldCheck}
          title="Permission controls are starting up"
          description="Check back in a few minutes. Until then your agent keeps working exactly as it does today, and you can set limits by asking in chat."
          action={
            <button type="button" onClick={perms.reload} className={buttonVariants({ variant: 'outline' })}>
              Try again
            </button>
          }
        />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionHeading title="Autonomy" />
            <OpsCard className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Whole agent</p>
                  <p className="text-xs text-muted-foreground">
                    {(d.modes ?? []).find((m) => m.id === (d.agent?.mode ?? d.default_mode))?.text || `Default: ${MODE_LABEL[d.default_mode]}`}
                  </p>
                </div>
                <ModePicker value={d.agent?.mode ?? d.default_mode} disabled={busy} onChange={(m) => void act('permissions/set', { scope: 'agent', mode: m })} />
              </div>
            </OpsCard>
            {d.apps.length > 0 && (
              <OpsCard className="divide-y divide-border p-0">
                {d.apps.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.label || a.app}</p>
                      {a.summary && <p className="text-xs text-muted-foreground">{a.summary}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <ModePicker allowInherit value={a.mode} disabled={busy} onChange={(m) => void act('permissions/set', { scope: 'app', app: a.app, mode: m })} />
                      <button type="button" disabled={busy} onClick={() => void act('permissions/revoke', { kind: 'policy', id: a.id })} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </OpsCard>
            )}
            {d.responsibilities.length > 0 && (
              <OpsCard className="divide-y divide-border p-0">
                {d.responsibilities.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <p className="min-w-0 text-sm">{r.summary || r.responsibility_id}</p>
                    <button type="button" disabled={busy} onClick={() => void act('permissions/revoke', { kind: 'policy', id: r.id })} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
                      Revoke
                    </button>
                  </div>
                ))}
              </OpsCard>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHeading title="Spending limits" count={d.limits.length} />
            {d.limits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spending limits yet. Say something like “you can spend up to $25 per change and $100 a month on Junk Removal ads” in chat.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {d.limits.map((s) => (
                  <SpendCard key={s.limit.id} s={s} busy={busy} onRevoke={() => void act('permissions/revoke', { kind: 'limit', id: s.limit.id })} />
                ))}
              </div>
            )}
          </section>

          {d.standing_grants.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeading title="One-time approvals still open" count={d.standing_grants.length} />
              <OpsCard className="divide-y divide-border p-0">
                {d.standing_grants.map((g) => (
                  <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">
                      {g.app} {g.tool ? `· ${g.tool}` : ''} {typeof g.uses_left === 'number' ? `· ${g.uses_left} use left` : ''}
                    </span>
                    <button type="button" disabled={busy} onClick={() => void act('permissions/revoke', { kind: 'grant', id: g.id })} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
                      Revoke
                    </button>
                  </div>
                ))}
              </OpsCard>
            </section>
          )}

          {d.browser_terminal && (
            <section className="flex flex-col gap-3">
              <SectionHeading title="Browser and terminal" />
              <OpsCard className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{d.browser_terminal.label || 'Allow browser & terminal'}</p>
                  <Switch checked={d.browser_terminal.enabled} disabled={busy} onCheckedChange={(v: boolean) => void act('permissions/browser-terminal', { enabled: v })} />
                </div>
                {d.browser_terminal.warning && <p className="text-xs text-muted-foreground">{d.browser_terminal.warning}</p>}
              </OpsCard>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <SectionHeading title="Approval history" />
            {(hist.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No permission changes yet.</p>
            ) : (
              <OpsCard className="divide-y divide-border p-0">
                {(hist.data?.items ?? []).map((h) => (
                  <div key={h.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-2.5">
                    <p className="min-w-0 text-sm">{h.summary}</p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {h.actor === 'customer' ? 'You' : h.actor} · {h.via} · {formatWhen(fromUnix(h.at))}
                    </p>
                  </div>
                ))}
              </OpsCard>
            )}
          </section>
        </>
      )}
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
