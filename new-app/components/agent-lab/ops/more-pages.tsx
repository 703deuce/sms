'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Brain, Download, FileText, Folder, Monitor, Phone, PhoneIncoming, PhoneOutgoing, RefreshCw, ShieldCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { callDirection, callNumber, callOutcome, callParty, displayName, formatDuration, formatWhen } from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'
import { MODE_LABEL, fromUnix, gbPost, gbUrl, money, type Call, type CallsDoc, type HistoryRow, type KnowledgeItem, type Mode, type PermissionsDoc, type Skill, type SpendSummary } from './gb14'
import { OpsCard, OpsEmpty, OpsError, OpsLoading, OpsPage, Pill, SectionHeading } from './ops-ui'
import { useOverview, usePolled } from './use-ops-data'

// ---------------- Calls ----------------

type CallFilter = 'all' | 'incoming' | 'outgoing'

const CALLS_LIMIT = 200

function CallRow({ c, open, onToggle }: { c: Call; open: boolean; onToggle: () => void }) {
  const [detail, setDetail] = useState<Call | null>(null)
  const [detailErr, setDetailErr] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setDetail(null)
    setDetailErr(null)
    setLoadingDetail(true)
    void fetch(gbUrl(`calls/${encodeURIComponent(c.id)}`), { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Call & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not load this call')
        return data
      })
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        if (!cancelled) setDetailErr(e instanceof Error ? e.message : 'Could not load this call')
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, c.id])

  const full = detail ? { ...c, ...detail } : c
  const dir = callDirection(full)
  const incoming = dir === 'incoming'
  const outcome = callOutcome(full)
  const when = formatWhen(fromUnix(full.at))
  const ended = formatWhen(fromUnix(full.ended_at))
  const dur = formatDuration(full.duration_s, full.status ?? full.outcome)
  const number = callNumber(full)
  const line = incoming ? full.to : full.from

  return (
    <li>
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', incoming ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground')}>
            {incoming ? <PhoneIncoming className="size-4" /> : <PhoneOutgoing className="size-4" />}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <span className="truncate">{callParty(full)}</span>
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{incoming ? 'Incoming' : 'Outgoing'}</span>
            </p>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {when}
              {dur ? ` · ${dur}` : ''}
              {full.summary ? ` · ${full.summary}` : full.goal ? ` · ${full.goal}` : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {full.after_hours ? <Pill tone="muted">After hours</Pill> : null}
          {full.needs_you ? <Pill tone="warning">Needs you</Pill> : null}
          {outcome ? <Pill tone={outcome.tone}>{outcome.label}</Pill> : null}
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{incoming ? 'Caller' : 'Called'}</dt>
              <dd className="mt-0.5 font-medium">
                {callParty(full)}
                {number ? <span className="block font-normal text-muted-foreground">{number}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Time</dt>
              <dd className="mt-0.5 font-medium">
                {when}
                {ended && ended !== when ? <span className="block font-normal text-muted-foreground">Ended {ended}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Duration</dt>
              <dd className="mt-0.5 font-medium">{dur || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Outcome</dt>
              <dd className="mt-0.5 font-medium">{outcome?.label ?? '—'}</dd>
            </div>
          </dl>
          {line && <p className="text-xs text-muted-foreground">{incoming ? 'Reached' : 'From'}: {displayName(line) || line}</p>}
          {full.status && full.outcome && full.status.toLowerCase() !== full.outcome.toLowerCase() && (
            <p className="text-xs text-muted-foreground">Status · {displayName(full.status) || full.status}</p>
          )}
          {full.goal && (
            <p>
              <span className="text-xs font-medium text-muted-foreground">Goal · </span>
              {full.goal}
            </p>
          )}
          {full.message && (
            <blockquote className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">{full.message}</blockquote>
          )}
          {full.summary && <p>{full.summary}</p>}
          {loadingDetail && !full.transcript ? (
            <p className="text-xs text-muted-foreground">Loading transcript…</p>
          ) : full.transcript ? (
            <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 font-sans text-xs whitespace-pre-wrap text-muted-foreground">{full.transcript}</pre>
          ) : (
            <p className="text-xs text-muted-foreground">{detailErr ? `${detailErr} The summary above is still from the list.` : 'No transcript for this call.'}</p>
          )}
        </div>
      )}
    </li>
  )
}

export function CallsPage() {
  const { data, error, loading, reload } = usePolled<CallsDoc>(gbUrl(`calls?kind=all&limit=${CALLS_LIMIT}`), 30_000)
  const [open, setOpen] = useState<string | null>(null)
  const [filter, setFilter] = useState<CallFilter>('all')
  const items = data?.items ?? []
  const incoming = items.filter((c) => callDirection(c) === 'incoming')
  const outgoing = items.filter((c) => callDirection(c) === 'outgoing')
  const shown = filter === 'incoming' ? incoming : filter === 'outgoing' ? outgoing : items
  const receptionist = data?.receptionist
  const receptionistReady = receptionist?.available !== false && (incoming.length > 0 || (receptionist?.count ?? 0) > 0)
  const capped = items.length >= CALLS_LIMIT

  return (
    <OpsPage icon={Phone} title="Calls" description="Incoming calls to your AI receptionist and outgoing calls your agent placed: who called, when, how long, a summary or transcript, and how each one ended.">
      {loading && !data ? (
        <OpsLoading />
      ) : items.length === 0 ? (
        <OpsEmpty
          icon={Phone}
          title="No calls to show yet"
          description={
            error
              ? 'Call history is starting up. Check back in a few minutes.'
              : receptionistReady
                ? 'When your agent answers or places a call, it will appear here with the caller, the time, how long it lasted, a summary or transcript, and the outcome.'
                : 'Outgoing calls your agent places will appear here. Incoming calls from the AI receptionist will show up as soon as that source is connected.'
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
        <>
          <div className="flex flex-wrap items-center gap-2">
            {([
              ['all', 'All', items.length],
              ['incoming', 'Incoming', incoming.length],
              ['outgoing', 'Outgoing', outgoing.length],
            ] as const).map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  filter === id ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {label} {n}
              </button>
            ))}
          </div>
          {capped && (
            <p className="text-sm text-muted-foreground">Showing the {CALLS_LIMIT} most recent calls.</p>
          )}
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No {filter} calls yet.</p>
          ) : (
            <OpsCard className="p-0">
              <ul className="divide-y divide-border">
                {shown.map((c) => (
                  <CallRow key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} />
                ))}
              </ul>
            </OpsCard>
          )}
        </>
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
          <p className="text-sm font-semibold">{displayName(s.limit.label || s.limit.target) || 'Spending limit'}</p>
          <p className="text-xs text-muted-foreground">
            {displayName(s.limit.app)}
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
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
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
                      <p className="text-sm font-medium">{displayName(a.label || a.app)}</p>
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
                    <p className="min-w-0 text-sm">{r.summary || displayName(r.responsibility_id)}</p>
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
              <p className="text-sm text-muted-foreground">No spending limits yet. Say something like “you can spend up to 25 dollars per change and 100 dollars a month on Junk Removal ads” in chat.</p>
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
                      {displayName(g.app)} {g.tool ? `· ${displayName(g.tool)}` : ''} {typeof g.uses_left === 'number' ? `· ${g.uses_left} use left` : ''}
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
                        {displayName(f.name) || f.name}
                      </a>
                      <p className="truncate text-xs text-muted-foreground">
                        {displayName(f.task) || f.task} · {formatWhen(f.modifiedAt)} · {size(f.size)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/api/agent-lab/file?path=${encodeURIComponent(f.path)}&download=1`}
                    aria-label={`Download ${displayName(f.name) || f.name}`}
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


// ---------------- Memory & skills ----------------

export function MemoryPage() {
  const knowledge = usePolled<{ total?: number; items: KnowledgeItem[] }>(gbUrl('knowledge?limit=100'), 60_000)
  const skills = usePolled<{ items: Skill[] }>(gbUrl('skills'), 60_000)
  const mem = knowledge.data?.items ?? []
  const sk = skills.data?.items ?? []
  const memUnavailable = !knowledge.data && !!knowledge.error
  const skUnavailable = !skills.data && !!skills.error
  const types = [...new Set(mem.map((k) => k.type).filter(Boolean))] as string[]

  return (
    <OpsPage
      icon={Brain}
      title="Memory & skills"
      description="What your agent remembers about you, and the skills it can use. Change either one by asking in chat — this page doesn't rename or overwrite what's stored."
      actions={
        <Link href="/app/agent-lab" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
          Talk it through in chat
        </Link>
      }
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3">
          <SectionHeading title="Memory" count={knowledge.data ? mem.length : undefined} />
          {knowledge.loading && !knowledge.data ? (
            <OpsLoading />
          ) : memUnavailable ? (
            <OpsEmpty
              icon={BookOpen}
              title="Memory is starting up"
              description="What your agent remembers will appear here. Check back in a few minutes, or tell it something in chat."
              action={
                <button type="button" onClick={knowledge.reload} className={buttonVariants({ variant: 'outline' })}>
                  Try again
                </button>
              }
            />
          ) : mem.length === 0 ? (
            <OpsEmpty
              icon={BookOpen}
              title="Nothing remembered yet"
              description="Facts, preferences and notes your agent learns will collect here. Tell it something in chat to get started."
              action={
                <Link href="/app/agent-lab" className={buttonVariants({ variant: 'outline' })}>
                  Add something in chat
                </Link>
              }
            />
          ) : (
            <OpsCard className="p-0">
              {types.length > 1 && (
                <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                  {types.map((t) => displayName(t) || t).join(' · ')}
                </p>
              )}
              <ul className="divide-y divide-border">
                {mem.map((k) => (
                  <li key={k.id} className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {k.type && <Pill tone="neutral">{displayName(k.type) || k.type}</Pill>}
                      {k.source && <span className="text-[11px] text-muted-foreground">{displayName(k.source) || k.source}</span>}
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{formatWhen(fromUnix(k.created_at))}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{k.text}</p>
                  </li>
                ))}
              </ul>
            </OpsCard>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <SectionHeading title="Skills" count={skills.data ? sk.length : undefined} />
          {skills.loading && !skills.data ? (
            <OpsLoading />
          ) : skUnavailable ? (
            <OpsEmpty
              icon={Brain}
              title="Skills are starting up"
              description="The skills your agent can use will appear here once this list is available."
              action={
                <button type="button" onClick={skills.reload} className={buttonVariants({ variant: 'outline' })}>
                  Try again
                </button>
              }
            />
          ) : sk.length === 0 ? (
            <OpsEmpty
              icon={Brain}
              title="No skills yet"
              description="Skills your agent can apply — research, drafting, reviews and the rest — will be listed here with a short description."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {sk.map((skill) => (
                <OpsCard key={skill.id} className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{displayName(skill.name) || skill.name}</p>
                    {skill.modified_at ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(fromUnix(skill.modified_at))}</span>
                    ) : null}
                  </div>
                  {skill.description && <p className="text-sm text-muted-foreground">{skill.description}</p>}
                </OpsCard>
              ))}
            </div>
          )}
        </section>
      </div>
    </OpsPage>
  )
}
