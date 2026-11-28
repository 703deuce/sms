'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Brain, CalendarCheck, Clock, Download, FileText, Folder, ImageIcon, MessageSquareText, Monitor, Phone, PhoneIncoming, PhoneOutgoing, RefreshCw, Sheet, ShieldCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { callDirection, callNumber, callOutcome, callParty, displayName, formatDuration, formatWhen } from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'
import { MODE_LABEL, fromUnix, gbPost, gbUrl, money, type Call, type CallsDoc, type HistoryRow, type KnowledgeItem, type Mode, type PermissionsDoc, type Skill, type SpendSummary } from './gb14'
import { AgentTag, inAgentScope, useAgentScope } from './agent-scope'
import { Donut, Drawer, Kpi, KpiGrid, Panel, PropList, SearchBox, Segmented, StackedColumns, Toolbar, dayKey, isOpaqueId, lastDays } from './ops-kit'
import { OpsCard, OpsEmpty, OpsError, OpsLoading, OpsPage, Pill, SectionHeading } from './ops-ui'
import { usePolled } from './use-ops-data'

// ---------------- Calls ----------------

type CallFilter = 'all' | 'incoming' | 'outgoing'

const CALLS_LIMIT = 200

/** True when the viewport matches; false until mounted so server and first client render agree. */
function useMediaQuery(query: string): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const m = window.matchMedia(query)
    const f = () => setOn(m.matches)
    f()
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [query])
  return on
}

function shortOutcome(label: string): string {
  const head = label.split(':')[0].trim()
  if (head.length >= 3 && head.length < label.length) return head
  return label.length > 40 ? `${label.slice(0, 37)}…` : label
}


/** Loads one call's full record (transcript included) and shows it. Used inline on phones and in the side pane on desktop. */
function CallDetailBody({ c }: { c: Call }) {
  const [detail, setDetail] = useState<Call | null>(null)
  const [detailErr, setDetailErr] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
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
  }, [c.id])

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
      <div className="flex flex-col gap-3 text-sm">
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
  )
}

function CallRow({ c, open, onToggle, selected, inline }: { c: Call; open: boolean; onToggle: () => void; selected?: boolean; inline: boolean } ) {
  const full = c
  const dir = callDirection(full)
  const incoming = dir === 'incoming'
  const outcome = callOutcome(full)
  const when = formatWhen(fromUnix(full.at))
  const ended = formatWhen(fromUnix(full.ended_at))
  const dur = formatDuration(full.duration_s, full.status ?? full.outcome)
  const number = callNumber(full)
  const line = incoming ? full.to : full.from

  return (
    <li className={cn(selected && 'bg-muted/50')}>
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
          {outcome ? <Pill tone={outcome.tone}>{shortOutcome(outcome.label)}</Pill> : null}
        </div>
      </button>
      {open && inline && (
        <div className="px-4 pb-4">
          <CallDetailBody c={c} />
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
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const visible = needle ? shown.filter((c) => `${callParty(c)} ${c.summary ?? ''} ${c.outcome ?? ''} ${c.message ?? ''}`.toLowerCase().includes(needle)) : shown
  const selected = desktop ? (visible.find((c) => c.id === open) ?? visible[0] ?? null) : null
  const days = lastDays(7)
  const perDay = days.map((d) => ({ in: incoming.filter((c) => c.at && dayKey(new Date(c.at * 1000)) === d.key).length, out: outgoing.filter((c) => c.at && dayKey(new Date(c.at * 1000)) === d.key).length }))
  const week = perDay.reduce((n, d) => n + d.in + d.out, 0)
  const outcomeCounts = new Map<string, number>()
  for (const c of incoming) {
    const o = callOutcome(c)
    const k = o ? shortOutcome(o.label) : 'Other'
    outcomeCounts.set(k, (outcomeCounts.get(k) ?? 0) + 1)
  }
  const sortedOutcomes = [...outcomeCounts.entries()].sort((a, b) => b[1] - a[1])
  const DONUT = ['stroke-primary', 'stroke-chart-2', 'stroke-chart-3', 'stroke-chart-4']
  const parts = [
    ...sortedOutcomes.slice(0, 4).map(([label, value], i) => ({ label, value, className: DONUT[i] })),
    ...(sortedOutcomes.length > 4 ? [{ label: 'Other', value: sortedOutcomes.slice(4).reduce((n, x) => n + x[1], 0), className: 'stroke-muted-foreground/50' }] : []),
  ]
  const booked = incoming.filter((c) => /book/i.test(callOutcome(c)?.label ?? '') && !/asked/i.test(callOutcome(c)?.label ?? '')).length
  const messages = incoming.filter((c) => /message/i.test(callOutcome(c)?.label ?? '')).length
  const durs = incoming.map((c) => c.duration_s ?? 0).filter((n) => n > 0)
  const avg = durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0

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
          <KpiGrid cols={4}>
            <Kpi label="Calls, last 7 days" value={week} icon={Phone} sub={`${incoming.length} incoming · ${outgoing.length} outgoing in total`} spark={perDay.map((d) => d.in + d.out)} />
            <Kpi label="Booked" value={booked} icon={CalendarCheck} tone={booked ? 'success' : 'neutral'} sub="Appointments from incoming calls" />
            <Kpi label="Messages taken" value={messages} icon={MessageSquareText} sub="Passed on to you" />
            <Kpi label="Average length" value={avg ? formatDuration(avg) : '—'} icon={Clock} sub="Incoming calls" />
          </KpiGrid>
          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="Calls per day" className="xl:col-span-2" action={<span className="text-xs text-muted-foreground">Last 7 days</span>}>
              <StackedColumns
                labels={days.map((d) => d.label)}
                series={[
                  { name: 'Incoming', values: perDay.map((d) => d.in), className: 'fill-primary' },
                  { name: 'Outgoing', values: perDay.map((d) => d.out), className: 'fill-chart-2' },
                ]}
                height={130}
              />
            </Panel>
            {parts.length > 0 && (
              <Panel title="How incoming calls ended">
                <Donut parts={parts} centerLabel="calls" />
              </Panel>
            )}
          </div>
          <Toolbar>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: items.length },
                { value: 'incoming', label: 'Incoming', count: incoming.length },
                { value: 'outgoing', label: 'Outgoing', count: outgoing.length },
              ]}
            />
            <SearchBox value={search} onChange={setSearch} placeholder="Search calls" />
          </Toolbar>
          {capped && (
            <p className="text-sm text-muted-foreground">Showing the {CALLS_LIMIT} most recent calls.</p>
          )}
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{needle ? 'No calls match.' : `No ${filter} calls yet.`}</p>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <OpsCard className="p-0">
                <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                  {visible.map((c) => (
                    <CallRow
                      key={c.id}
                      c={c}
                      open={open === c.id}
                      selected={desktop && selected?.id === c.id}
                      inline={!desktop}
                      onToggle={() => setOpen(open === c.id && !desktop ? null : c.id)}
                    />
                  ))}
                </ul>
              </OpsCard>
              {desktop && selected && (
                <OpsCard className="sticky top-4 flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{callParty(selected)}</h2>
                    <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{callDirection(selected) === 'incoming' ? 'Incoming' : 'Outgoing'}</span>
                    {selected.after_hours ? <Pill tone="muted">After hours</Pill> : null}
                    {selected.needs_you ? <Pill tone="warning">Needs you</Pill> : null}
                  </div>
                  <CallDetailBody key={selected.id} c={selected} />
                </OpsCard>
              )}
            </div>
          )}
        </>
      )}
    </OpsPage>
  )
}

// ---------------- Permissions ----------------

const MODES: Mode[] = ['supervised', 'selective', 'full']

const MODE_HINT: Record<Mode, string> = {
  supervised: 'Direct asks run. Scheduled work asks before changing anything outside, and money or deleting always asks.',
  selective: 'Direct asks run. Scheduled work asks only before money or deleting.',
  full: 'Never asks. Only your own rules and spending limits apply.',
}

type RuleState = 'allow' | 'ask' | 'deny'
const RULE_CYCLE: Record<RuleState | 'default', RuleState> = { default: 'ask', ask: 'allow', allow: 'deny', deny: 'ask' }
const RULE_STYLE: Record<RuleState | 'default', { label: string; cls: string; dot: string }> = {
  allow: { label: 'Allow', cls: 'border-success/40 bg-success/10 text-success', dot: 'bg-success' },
  ask: { label: 'Ask', cls: 'border-warning/40 bg-warning/10 text-warning', dot: 'bg-warning' },
  deny: { label: 'Never', cls: 'border-destructive/40 bg-destructive/10 text-destructive', dot: 'bg-destructive' },
  default: { label: 'Default', cls: 'border-dashed border-border text-muted-foreground', dot: 'bg-muted-foreground/40' },
}

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
  const conn = usePolled<{ connected?: Record<string, { status?: string }> }>('/api/agent-lab/connections/connected', 60_000)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const d = perms.data
  // One row per connected app (plus any app that already has a rule), with its policy if there is one.
  const appRows = useMemo(() => {
    const slugs = new Set<string>()
    for (const [slug, v] of Object.entries(conn.data?.connected ?? {})) if ((v.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE') slugs.add(slug.toLowerCase())
    for (const a of d?.apps ?? []) if (a.app) slugs.add(a.app.toLowerCase())
    return [...slugs].sort().map((app) => ({ app, policy: (d?.apps ?? []).find((p) => (p.app ?? '').toLowerCase() === app) ?? null }))
  }, [conn.data, d])

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
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <section className="flex flex-col gap-3">
            <SectionHeading title="Autonomy" />
            <div className="rounded-card border border-border bg-card p-4 shadow-xs">
              <p className="text-sm font-semibold">Whole agent</p>
              <p className="mt-0.5 text-xs text-muted-foreground">How much it does on its own across your connected apps. Your rules and spending limits always apply.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Autonomy">
                {MODES.map((m) => {
                  const current = (d.agent?.mode ?? d.default_mode) === m
                  const info = (d.modes ?? []).find((x) => x.id === m)
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={current}
                      disabled={busy}
                      onClick={() => !current && void act('permissions/set', { scope: 'agent', mode: m })}
                      className={cn(
                        'flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors',
                        current ? 'border-primary bg-primary/[0.07] ring-1 ring-primary/40' : 'border-border hover:border-foreground/20 hover:bg-muted/40',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{info?.label || MODE_LABEL[m]}</span>
                        <span className={cn('grid size-4 place-items-center rounded-full border', current ? 'border-primary' : 'border-muted-foreground/40')}>
                          {current && <span className="size-2 rounded-full bg-primary" />}
                        </span>
                      </span>
                      <span className="text-xs leading-relaxed text-muted-foreground">{info?.text || MODE_HINT[m]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            {appRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">App rules</p>
                <p className="text-xs text-muted-foreground">Set how much your agent may do in each connected app. Tap a rule to cycle Ask, Allow and Never.</p>
                <OpsCard className="divide-y divide-border p-0">
                  {appRows.map(({ app, policy }) => (
                    <div key={app} className="flex flex-col gap-2.5 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{displayName(policy?.label || app)}</p>
                          {policy?.summary && <p className="text-xs text-muted-foreground">{policy.summary}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <ModePicker allowInherit value={policy?.mode ?? null} disabled={busy} onChange={(m) => void act('permissions/set', { scope: 'app', app, mode: m })} />
                          {policy && (
                            <button type="button" disabled={busy} onClick={() => void act('permissions/revoke', { kind: 'policy', id: policy.id })} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${displayName(app)} rules`}>
                        {(d.categories ?? []).map((c) => {
                          const cur = policy?.rules?.[c.id] ?? null
                          const next = RULE_CYCLE[cur ?? 'default']
                          const st = cur ? RULE_STYLE[cur] : RULE_STYLE.default
                          return (
                            <button
                              key={c.id}
                              type="button"
                              disabled={busy}
                              title={`${c.label}: ${st.label}. Tap to change to ${RULE_STYLE[next].label}.`}
                              onClick={() => void act('permissions/set', { scope: 'app', app, rules: { [c.id]: next } })}
                              className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:brightness-110 disabled:opacity-60', st.cls)}
                            >
                              <span className={cn('size-1.5 rounded-full', st.dot)} aria-hidden />
                              {c.label}
                              <span className="font-normal opacity-80">· {st.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </OpsCard>
              </div>
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

          </div>
          <aside className="flex min-w-0 flex-col gap-6">
          <Panel title="At a glance">
            <PropList
              items={[
                { label: 'Autonomy', value: MODE_LABEL[d.agent?.mode ?? d.default_mode] },
                { label: 'App rules', value: String(d.apps.length) },
                { label: 'Spending limits', value: String(d.limits.length) },
                {
                  label: 'Waiting on you',
                  value: d.pending_approvals + d.pending_changes > 0 ? (
                    <Link href="/app/agent-lab/needs-you" className="font-medium text-primary hover:underline">
                      {d.pending_approvals + d.pending_changes}
                    </Link>
                  ) : (
                    'Nothing'
                  ),
                },
              ]}
            />
          </Panel>
          <section className="flex flex-col gap-3">
            <SectionHeading title="Approval history" />
            {(hist.data?.items ?? []).length === 0 ? (
              <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No permission changes yet. Changes you make here or in chat are recorded with who made them.</p>
            ) : (
              <ol className="relative ml-2 flex flex-col gap-4 border-l border-border pl-5">
                {(hist.data?.items ?? []).map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[1.6rem] top-1 size-2.5 rounded-full bg-primary ring-4 ring-background" aria-hidden />
                    <p className="text-sm">{h.summary}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {h.actor === 'customer' ? 'You' : displayName(h.actor)} · {h.via === 'ui' ? 'this page' : h.via} · {formatWhen(fromUnix(h.at))}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
          </aside>
        </div>
      )}
    </OpsPage>
  )
}

// ---------------- Computer ----------------

type DesktopStatus = { status?: string | null; message?: string | null; kind?: string | null; error?: string | null }

export function ComputerPage() {
  const { data, error } = usePolled<DesktopStatus>('/api/agent-lab/desktop/status', 10_000)
  const jobs = usePolled<{ items: { run_id?: string; title?: string | null; status?: string; started_at?: number | null }[] }>(gbUrl('assignments'), 15_000)
  const [tick, setTick] = useState(0)
  const [imgFailed, setImgFailed] = useState(false)
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1)
    }, 3000)
    return () => clearInterval(t)
  }, [])
  const live = !imgFailed
  const working = jobs.data?.items ?? []
  return (
    <OpsPage icon={Monitor} title="Computer" description="Watch your agent's own computer while it works. To take control, ask in chat and you'll get a live session.">
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 overflow-hidden rounded-card border border-border bg-card shadow-xs">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs">
            <span className={cn('size-2 rounded-full', live ? 'bg-success shadow-[0_0_0_3px] shadow-success/20' : 'bg-muted-foreground/50')} />
            <span className="font-medium">{live ? 'Live' : 'Not live'}</span>
            <span className="text-muted-foreground">· refreshes every few seconds</span>
          </div>
          {imgFailed ? (
            <div className="grid aspect-video w-full place-items-center bg-muted/40 p-6 text-center">
              <div>
                <Monitor className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">The screen isn&apos;t live right now</p>
                <p className="mt-1 text-sm text-muted-foreground">It appears here while your agent is using its browser or desktop.</p>
              </div>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/agent-lab/desktop/live?t=${tick}`}
              alt="Your agent's screen"
              className="block aspect-video w-full bg-muted object-contain"
              onError={() => setImgFailed(true)}
              onLoad={() => setImgFailed(false)}
            />
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="What it's doing">
            {working.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing running right now. When it opens a website, you&apos;ll see it here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {working.slice(0, 5).map((j, i) => (
                  <li key={j.run_id ?? i} className="flex items-center gap-2 text-sm">
                    <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
                    <span className="min-w-0 truncate">{displayName(j.title) || 'Task'}</span>
                  </li>
                ))}
              </ul>
            )}
            {(data?.message || error) && <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{data?.message || 'Status unavailable right now.'}</p>}
          </Panel>
          <Panel title="Take control">
            <p className="text-sm text-muted-foreground">Ask in chat to take over, for example to sign in to a site. You&apos;ll get a live session you can click and type in.</p>
            <Link href="/app/agent-lab" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-3')}>
              Ask in chat
            </Link>
          </Panel>
        </div>
      </div>
    </OpsPage>
  )
}

// ---------------- Files ----------------

type GbFile = { path: string; name: string; size: number; modified_at: number; run_id?: string | null; title?: string | null; agent_id?: string | null; agent_name?: string | null; agent_avatar?: string | null }
type FileKind = 'doc' | 'sheet' | 'image' | 'other'

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i

function fileKind(name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['md', 'txt', 'pdf', 'doc', 'docx', 'html', 'json', 'pptx'].includes(ext)) return 'doc'
  if (['csv', 'xlsx', 'xls', 'tsv'].includes(ext)) return 'sheet'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  return 'other'
}

const KIND_META: Record<FileKind, { label: string; icon: typeof FileText; cls: string }> = {
  doc: { label: 'Document', icon: FileText, cls: 'bg-primary/10 text-primary' },
  sheet: { label: 'Sheet', icon: Sheet, cls: 'bg-success/15 text-success' },
  image: { label: 'Image', icon: ImageIcon, cls: 'bg-warning/15 text-warning' },
  other: { label: 'File', icon: FileText, cls: 'bg-secondary text-muted-foreground' },
}

function size(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const fileUrl = (path: string, download = false) => `/api/agent-lab/file?path=${encodeURIComponent(path)}${download ? '&download=1' : ''}`

function FilePreview({ f }: { f: GbFile }) {
  const kind = fileKind(f.name)
  const [text, setText] = useState<string | null>(null)
  const textual = /\.(md|txt|csv|tsv|json)$/i.test(f.name)
  useEffect(() => {
    if (!textual) return
    let alive = true
    fetch(fileUrl(f.path), { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => alive && setText(t.slice(0, 40_000)))
      .catch(() => alive && setText(''))
    return () => {
      alive = false
    }
  }, [f.path, textual])
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fileUrl(f.path)} alt={f.name} className="w-full rounded-lg border border-border bg-muted object-contain" />
  }
  if (!textual) return <p className="text-sm text-muted-foreground">No preview for this type. Download it to open.</p>
  if (text === null) return <div className="h-40 animate-pulse rounded-lg bg-muted" />
  if (/\.(csv|tsv)$/i.test(f.name)) {
    const sep = f.name.toLowerCase().endsWith('.tsv') ? '\t' : ','
    const rows = text.split(/\r?\n/).filter(Boolean).slice(0, 26).map((l) => l.split(sep))
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={cn('border-b border-border/60 last:border-0', i === 0 && 'bg-muted/50 font-medium')}>
                {r.slice(0, 8).map((c, j) => (
                  <td key={j} className="max-w-[14rem] truncate px-2.5 py-1.5">
                    {c.replace(/^"|"$/g, '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed">{text}</pre>
}

export function FilesPage() {
  const q = usePolled<{ items: GbFile[] }>(gbUrl('files?limit=200'), 60_000)
  const [kind, setKind] = useState<'all' | FileKind>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<GbFile | null>(null)
  const scope = useAgentScope()
  const all = (q.data?.items ?? []).filter((f) => !VIDEO_EXT.test(f.name) && inAgentScope(f, scope.agentId))
  const needle = search.trim().toLowerCase()
  const files = all.filter((f) => (kind === 'all' || fileKind(f.name) === kind) && (!needle || `${f.name} ${f.title ?? ''}`.toLowerCase().includes(needle)))
  const n = (k: FileKind) => all.filter((f) => fileKind(f.name) === k).length
  return (
    <OpsPage
      agentScoped
      icon={Folder}
      title="Files"
      description="Everything your agent made for you across recent tasks: reports, sheets, decks, images and drafts."
      actions={
        <button type="button" onClick={q.reload} className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
          <RefreshCw className={cn('size-4', q.loading && 'animate-spin')} />
          Refresh
        </button>
      }
    >
      {q.error && !q.data && <OpsError message={q.error} onRetry={q.reload} />}
      {q.loading && !q.data ? (
        <OpsLoading />
      ) : all.length === 0 ? (
        <OpsEmpty icon={FileText} title="No files yet" description="Reports, spreadsheets, images and drafts your agent saves for you will collect here." />
      ) : (
        <>
          <Toolbar>
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: 'All', count: all.length },
                { value: 'doc', label: 'Documents', count: n('doc') },
                { value: 'sheet', label: 'Sheets', count: n('sheet') },
                { value: 'image', label: 'Images', count: n('image') },
                ...(n('other') ? [{ value: 'other' as const, label: 'Other', count: n('other') }] : []),
              ]}
            />
            <Segmented value={view} onChange={setView} options={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }]} />
            <SearchBox value={search} onChange={setSearch} placeholder="Search files" />
          </Toolbar>
          {files.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No files match.</p>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {files.map((f) => {
                const k = KIND_META[fileKind(f.name)]
                const Icon = k.icon
                return (
                  <button key={f.path} type="button" onClick={() => setOpen(f)} className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card text-left shadow-xs transition hover:-translate-y-px hover:border-foreground/15">
                    <div className="relative grid h-28 place-items-center overflow-hidden border-b border-border bg-muted/30">
                      {fileKind(f.name) === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileUrl(f.path)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <span className={cn('grid size-12 place-items-center rounded-xl', k.cls)}>
                          <Icon className="size-6" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 p-3">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      {scope.multi && <div className="mt-1"><AgentTag item={f} multi /></div>}
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{displayName(f.title) || k.label}</p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {formatWhen(fromUnix(f.modified_at))} · {size(f.size)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-card shadow-xs">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-b border-border text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">From task</th>
                    <th className="px-4 py-2.5 font-medium">Made</th>
                    <th className="px-4 py-2.5 text-right font-medium">Size</th>
                    <th className="w-12 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => {
                    const k = KIND_META[fileKind(f.name)]
                    const Icon = k.icon
                    return (
                      <tr key={f.path} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40" onClick={() => setOpen(f)}>
                        <td className="px-4 py-2.5">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className={cn('grid size-7 shrink-0 place-items-center rounded-md', k.cls)}>
                              <Icon className="size-3.5" />
                            </span>
                            <span className="truncate font-medium">{f.name}</span>
                          </span>
                        </td>
                        <td className="max-w-[18rem] truncate px-4 py-2.5 text-muted-foreground">{displayName(f.title) || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatWhen(fromUnix(f.modified_at))}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-muted-foreground">{size(f.size)}</td>
                        <td className="px-2 py-2.5">
                          <a href={fileUrl(f.path, true)} onClick={(e) => e.stopPropagation()} aria-label={`Download ${f.name}`} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
                            <Download />
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.name ?? ''}
        description={open ? `${displayName(open.title) || 'File'} · ${formatWhen(fromUnix(open.modified_at))} · ${size(open.size)}` : undefined}
        footer={
          open && (
            <>
              <a href={fileUrl(open.path, true)} className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-2')}>
                <Download className="size-4" /> Download
              </a>
              <a href={fileUrl(open.path)} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Open in new tab
              </a>
            </>
          )
        }
      >
        {open && <FilePreview f={open} />}
      </Drawer>
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
  const [tab, setTab] = useState<'memory' | 'skills'>('memory')
  const [type, setType] = useState<string>('all')
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const memShown = mem.filter((k) => (type === 'all' || k.type === type) && (!needle || `${k.text} ${k.source ?? ''}`.toLowerCase().includes(needle)))
  const skShown = sk.filter((x) => !needle || `${x.name} ${x.description ?? ''}`.toLowerCase().includes(needle))

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
      <Toolbar>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'memory', label: 'Memory', count: knowledge.data ? mem.length : undefined },
            { value: 'skills', label: 'Skills', count: skills.data ? sk.length : undefined },
          ]}
        />
        {tab === 'memory' && types.length > 1 && (
          <Segmented
            value={type}
            onChange={setType}
            options={[{ value: 'all', label: 'All types' }, ...types.map((t) => ({ value: t, label: displayName(t) || t, count: mem.filter((k) => k.type === t).length }))]}
          />
        )}
        <SearchBox value={q} onChange={setQ} placeholder={tab === 'memory' ? 'Search memory' : 'Search skills'} />
      </Toolbar>
      <div>
        {tab === 'memory' && (
        <section className="flex min-w-0 flex-col gap-3">
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
            <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
              {memShown.map((k) => (
                <div key={k.id} className="mb-4 break-inside-avoid rounded-card border border-border bg-card p-4 shadow-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {k.type && <Pill tone={k.type === 'rule' ? 'info' : k.type === 'preference' ? 'success' : 'neutral'}>{displayName(k.type) || k.type}</Pill>}
                    <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{formatWhen(fromUnix(k.created_at))}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{k.text}</p>
                  {k.source && !isOpaqueId(k.source) && <p className="mt-2 text-[11px] text-muted-foreground">From {displayName(k.source) || k.source}</p>}
                </div>
              ))}
              {memShown.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches.</p>}
            </div>
          )}
        </section>
        )}

        {tab === 'skills' && (
        <section className="flex min-w-0 flex-col gap-3">
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
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {skShown.map((skill) => (
                <OpsCard key={skill.id} className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">{displayName(skill.name) || skill.name}</p>
                    {skill.modified_at ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(fromUnix(skill.modified_at))}</span>
                    ) : null}
                  </div>
                  {skill.description && <p className="line-clamp-3 text-sm text-muted-foreground">{skill.description}</p>}
                </OpsCard>
              ))}
              {skShown.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches.</p>}
            </div>
          )}
        </section>
        )}
      </div>
    </OpsPage>
  )
}
