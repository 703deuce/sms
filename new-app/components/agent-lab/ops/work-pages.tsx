'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  PauseCircle,
  Plug,
  Repeat,
  TriangleAlert,
  Zap,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Inbox,
  ListChecks,
  Plus,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  RESPONSIBILITY_STATUS,
  RUN_STATE_LABEL,
  assignments,
  chatHref,
  cronToWords,
  displayName,
  formatWhen,
  responsibilityStatus,
  runState,
  type OpsQuestion,
  type OpsRoutine,
  type OpsRun,
  type ResponsibilityStatus,
  type Tone,
} from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'
import { fromUnix, gbPost, gbUrl, type Approval, type PendingChange, type Version } from './gb14'
import { Dot, Drawer, Kpi, KpiGrid, Panel, PropList, SearchBox, Segmented, StackedColumns, TONE_BAR, Toolbar, dayHeading, plainError, plainSummary } from './ops-kit'
import { useWeekStats, type CalItem } from './use-week'
import { OpsCard, OpsEmpty, OpsError, OpsLoading, OpsPage, Pill, SectionHeading } from './ops-ui'
import { useOverview, usePolled } from './use-ops-data'

const chatLink = cn(buttonVariants({ variant: 'outline', size: 'sm' }))

function NewResponsibilityButton() {
  return (
    <Link href="/app/agent-lab" className={cn(buttonVariants({ variant: 'default' }), 'gap-2 shadow-sm')}>
      <Plus className="size-4" />
      New responsibility
    </Link>
  )
}

// ---------------- Needs you ----------------

function QuestionCard({ q, onAnswered }: { q: OpsQuestion; onAnswered: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function send(answer: string) {
    if (!answer.trim()) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/agent-lab/questions/${encodeURIComponent(q.id)}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }
      if (!res.ok || !body.ok) throw new Error(body.error || 'This question was already answered or has expired.')
      onAnswered()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send your answer')
    } finally {
      setBusy(false)
    }
  }
  return (
    <OpsCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{displayName(q.title) || 'Your agent has a question'}</p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{q.question}</p>
        </div>
        <Pill tone="warning">Question</Pill>
      </div>
      {q.choices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {q.choices.map((c) => (
            <button key={c} type="button" disabled={busy} onClick={() => void send(c)} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send(text)
          }}
          placeholder="Type an answer"
          className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <button type="button" disabled={busy || !text.trim()} onClick={() => void send(text)} className={buttonVariants({ size: 'sm' })}>
          Send
        </button>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <p className="text-[11px] text-muted-foreground">Asked {formatWhen(q.createdAt)}</p>
    </OpsCard>
  )
}

function ApprovalCard({ a, onDone }: { a: Approval; onDone: () => void }) {
  const [perAction, setPerAction] = useState(a.amount ? String(a.amount) : '')
  const [perMonth, setPerMonth] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const money = a.category === 'financial' || typeof a.amount === 'number'
  const choices = a.choices?.length ? a.choices : [
    { id: 'once' as const, label: 'Allow once' },
    { id: 'always' as const, label: 'Always allow within limits' },
    { id: 'deny' as const, label: 'Deny' },
  ]
  async function decide(choice: 'once' | 'always' | 'deny') {
    setBusy(true)
    setErr(null)
    try {
      const body: Record<string, unknown> = { choice }
      if (choice === 'always' && money) {
        const pa = Number(perAction), pm = Number(perMonth)
        if (!(pa > 0) || !(pm >= pa)) throw new Error('Set a per-action amount and a monthly cap at least that large.')
        body.limits = { per_action_max: pa, period: 'month', period_max: pm }
      }
      await gbPost(`permissions/approvals/${encodeURIComponent(a.id)}/decide`, body)
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That did not go through')
    } finally {
      setBusy(false)
    }
  }
  return (
    <OpsCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{displayName(a.title) || 'Your agent needs your OK'}</p>
          {a.consequence && <p className="mt-1 text-sm text-muted-foreground">{a.consequence}</p>}
          {a.reason && <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>}
        </div>
        <Pill tone="warning">Approval</Pill>
      </div>
      {money && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          <label className="text-xs text-muted-foreground">
            Per action, USD
            <input type="number" min="0" value={perAction} onChange={(e) => setPerAction(e.target.value)} className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            Per month, USD
            <input type="number" min="0" value={perMonth} onChange={(e) => setPerMonth(e.target.value)} className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm text-foreground" />
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={busy}
            onClick={() => void decide(c.id)}
            className={buttonVariants({ variant: c.id === 'once' ? 'default' : c.id === 'deny' ? 'ghost' : 'outline', size: 'sm' })}
          >
            {c.label}
          </button>
        ))}
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {a.created_at ? <p className="text-[11px] text-muted-foreground">Asked {formatWhen(fromUnix(a.created_at))}</p> : null}
    </OpsCard>
  )
}

function ChangeCard({ c, onDone }: { c: PendingChange; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const go = async (what: 'confirm' | 'reject') => {
    setBusy(true)
    try {
      await gbPost(`permissions/pending-changes/${encodeURIComponent(c.id)}/${what}`)
      onDone()
    } finally {
      setBusy(false)
    }
  }
  return (
    <OpsCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium">{c.summary}</p>
        <Pill tone="warning">Permission change</Pill>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void go('confirm')} className={buttonVariants({ size: 'sm' })}>
          Confirm
        </button>
        <button type="button" disabled={busy} onClick={() => void go('reject')} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Keep as is
        </button>
      </div>
    </OpsCard>
  )
}

function recentFailures(runs: OpsRun[]): OpsRun[] {
  const cutoff = Date.now() - 72 * 3600 * 1000
  return runs.filter((r) => !r.helper && runState(r.status) === 'failed' && new Date(r.finishedAt ?? r.createdAt).getTime() > cutoff)
}

type GbNeed = { id: string; kind: string; title: string; body?: string; created_at?: number; run_id?: string | null; conversation_id?: string | null }

export function NeedsYouPage() {
  const { data, error, loading, reload } = useOverview()
  const appr = usePolled<{ items: Approval[] }>(gbUrl('permissions/approvals?status=pending'), 15_000)
  const changes = usePolled<{ items: PendingChange[] }>(gbUrl('permissions/pending-changes'), 30_000)
  const needs = usePolled<{ items: GbNeed[] }>(gbUrl('needs-you'), 30_000)
  const week = useWeekStats()
  const approvals = (appr.data?.items ?? []).filter((a) => a.status === 'pending' || !a.status)
  const pendingChanges = (changes.data?.items ?? []).filter((c) => c.status === 'pending' || !c.status)
  const questions = data?.questions ?? []
  const local = recentFailures(data?.runs ?? [])
  // Problems: recent failed runs plus the server's own Needs-you failures and connection problems (deduplicated by run).
  const problems = useMemo(() => {
    const out: { id: string; title: string; body: string; at: string | null; conversationId: string | null }[] = local.map((r) => ({
      id: r.id,
      title: displayName(r.title) || 'Task',
      body: plainError(r.error),
      at: r.finishedAt ?? r.createdAt,
      conversationId: r.conversationId,
    }))
    for (const n of needs.data?.items ?? []) {
      if (n.kind !== 'failure' && n.kind !== 'connection') continue
      if (out.some((x) => x.id === n.run_id || x.id === n.id)) continue
      out.push({
        id: n.run_id || n.id,
        title: displayName(n.title.replace(/^Could not finish:\s*/i, '')) || 'Task',
        body: n.kind === 'connection' ? 'An app needs to be reconnected before this can continue.' : plainError(n.body),
        at: fromUnix(n.created_at),
        conversationId: n.conversation_id ?? null,
      })
    }
    return out
  }, [local, needs.data])
  const total = questions.length + problems.length + approvals.length + pendingChanges.length
  const handled = week.stats ? week.stats.totals.done + week.stats.totals.warning : null
  return (
    <OpsPage icon={Inbox} title="Needs you" description="Only what your agent can't decide or couldn't fix. Work you've already authorized never waits here.">
      <KpiGrid cols={4}>
        <Kpi label="Approvals" value={approvals.length + pendingChanges.length} icon={ShieldCheck} tone={approvals.length + pendingChanges.length ? 'warning' : 'neutral'} sub={approvals.length + pendingChanges.length ? 'Waiting for your OK' : 'Nothing to approve'} loading={appr.loading && !appr.data} />
        <Kpi label="Questions" value={questions.length} icon={MessageCircleQuestion} tone={questions.length ? 'warning' : 'neutral'} sub={questions.length ? 'Your agent asked you' : 'None open'} loading={loading && !data} />
        <Kpi label="Problems" value={problems.length} icon={CircleAlert} tone={problems.length ? 'danger' : 'neutral'} sub={problems.length ? "Couldn't finish on its own" : 'Nothing stuck'} loading={loading && !data} />
        <Kpi label="Handled without you" value={handled ?? '—'} icon={Sparkles} tone="success" sub="This week" loading={handled === null} spark={week.stats ? week.stats.done : undefined} />
      </KpiGrid>
      {error && !data && <OpsError message={error} onRetry={reload} />}
      {loading && !data ? (
        <OpsLoading />
      ) : data && data.questions === null && data.runs === null ? (
        <OpsError message="This list is temporarily unavailable." onRetry={reload} />
      ) : total === 0 ? (
        <OpsEmpty
          icon={Sparkles}
          title="All clear"
          description={`Your agent is handling everything on its own${handled ? `: ${handled} things finished this week` : ''}. Questions and anything it couldn't finish will show up here.`}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
            {approvals.length > 0 && (
              <section className="flex flex-col gap-3">
                <SectionHeading title="Approvals" count={approvals.length} />
                {approvals.map((a) => (
                  <ApprovalCard key={a.id} a={a} onDone={appr.reload} />
                ))}
              </section>
            )}
            {pendingChanges.length > 0 && (
              <section className="flex flex-col gap-3">
                <SectionHeading title="Permission changes from chat" count={pendingChanges.length} />
                {pendingChanges.map((c) => (
                  <ChangeCard key={c.id} c={c} onDone={changes.reload} />
                ))}
              </section>
            )}
            {questions.length > 0 && (
              <section className="flex flex-col gap-3">
                <SectionHeading title="Questions" count={questions.length} />
                {questions.map((q) => (
                  <QuestionCard key={q.id} q={q} onAnswered={reload} />
                ))}
              </section>
            )}
            {problems.length > 0 && (
              <section className="flex flex-col gap-3">
                <SectionHeading title="Couldn't finish" count={problems.length} />
                <div className="flex flex-col gap-2">
                  {problems.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-start gap-3 rounded-card border border-l-[3px] border-border border-l-destructive bg-card px-4 py-3 shadow-xs">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                        <CircleAlert className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{r.title}</p>
                        {r.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.body}</p>}
                        <p className="mt-1 text-[11px] text-muted-foreground">{formatWhen(r.at)}</p>
                      </div>
                      <Link href={r.conversationId ? chatHref(r.conversationId) : '/app/agent-lab'} className={chatLink}>
                        Open chat
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
          <Panel title="How this list works" className="h-fit">
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />Approvals only appear for actions your own rules or limits say to ask about.</li>
              <li className="flex gap-2"><MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" />Questions appear when something is genuinely unclear.</li>
              <li className="flex gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0 text-primary" />Problems are work it couldn&apos;t finish after trying other ways.</li>
            </ul>
          </Panel>
        </div>
      )}
    </OpsPage>
  )
}

function NeedsYouStrip({ questions, failures }: { questions: number; failures: number }) {
  const n = questions + failures
  if (n === 0) return null
  return (
    <Link
      href="/app/agent-lab/needs-you"
      className="flex items-center justify-between gap-3 rounded-card border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
    >
      <span className="flex items-center gap-2 font-medium">
        <CircleAlert className="size-4 text-warning" />
        {n} {n === 1 ? 'thing needs' : 'things need'} you
        <span className="font-normal text-muted-foreground">
          {[questions ? `${questions} question${questions === 1 ? '' : 's'}` : '', failures ? `${failures} couldn't finish` : ''].filter(Boolean).join(' · ')}
        </span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  )
}

// ---------------- Responsibilities ----------------

type StatusFilter = 'all' | ResponsibilityStatus

type Preview = { preview_id: string; before?: { name?: string; when?: string; prompt?: string }; after?: { name?: string; when?: string; prompt?: string }; changes?: string[] }

function ResponsibilityCard({ r, status, lastRun, onChanged }: { r: OpsRoutine; status: ResponsibilityStatus; lastRun: OpsRun | undefined; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [versions, setVersions] = useState<Version[] | null>(null)
  const st = RESPONSIBILITY_STATUS[status]
  const id = encodeURIComponent(r.id)

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true)
    setErr(null)
    try {
      return await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'That did not go through')
      return null
    } finally {
      setBusy(false)
    }
  }
  async function loadVersions() {
    const res = await fetch(gbUrl(`responsibilities/${id}/versions`), { cache: 'no-store' })
    if (res.ok) setVersions(((await res.json()) as { items?: Version[] }).items ?? [])
  }

  return (
    <OpsCard className={cn('flex flex-col gap-3 border-l-[3px]', TONE_BAR[st.tone])}>
      <div className="flex items-start gap-3">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', r.paused ? 'bg-secondary text-muted-foreground' : 'bg-primary/10 text-primary')}>
          {r.cron ? <CalendarDays className="size-4" /> : <Zap className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{displayName(r.name) || 'Responsibility'}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{r.cron ? 'Schedule' : 'App event'}{lastRun ? ` · last ran ${formatWhen(lastRun.finishedAt ?? lastRun.createdAt)}` : r.lastRunAt ? ` · last ran ${formatWhen(r.lastRunAt)}` : ''}</p>
        </div>
        <Pill tone={st.tone}>{st.label}</Pill>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">When</dt>
          <dd className="mt-0.5 font-medium">{cronToWords(r.cron, r.kind)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Next</dt>
          <dd className="mt-0.5 font-medium">{status === 'paused' || status === 'finished' ? '—' : formatWhen(r.nextRunAt)}</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen(!open)
            if (!open && versions === null) void loadVersions()
          }}
          aria-expanded={open}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          {open ? 'Less' : 'More'}
        </button>
        {status !== 'finished' && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {r.paused ? 'Paused' : 'On'}
            <Switch
              size="sm"
              checked={!r.paused}
              disabled={busy}
              onCheckedChange={(v: boolean) => void run(() => gbPost(`responsibilities/${id}/${v ? 'resume' : 'pause'}`)).then((ok) => ok !== null && onChanged())}
            />
          </label>
        )}
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {open && (
        <div className="flex flex-col gap-3 border-t border-border pt-3 text-sm">
          {r.instruction && <p className="whitespace-pre-wrap text-muted-foreground">{r.instruction}</p>}
          <div className="text-xs">
            <span className="text-muted-foreground">Last run: </span>
            {lastRun ? (
              <>
                {formatWhen(lastRun.finishedAt ?? lastRun.startedAt ?? lastRun.createdAt)} · {RUN_STATE_LABEL[runState(lastRun.status)].label}
                {lastRun.error ? ` · ${plainError(lastRun.error)}` : lastRun.progress ? ` · ${plainSummary(lastRun.progress)}` : ''}
              </>
            ) : r.lastRunAt ? (
              formatWhen(r.lastRunAt)
            ) : (
              'Not run yet'
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`edit-${r.id}`}>
              Change it in words
            </label>
            <div className="flex gap-2">
              <input
                id={`edit-${r.id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="make it 9am instead"
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => void run(() => gbPost<Preview>(`responsibilities/${id}/preview`, { instruction: draft.trim() })).then((p) => p && setPreview(p))}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Preview
              </button>
            </div>
          </div>
          {preview && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              {(preview.changes ?? []).length > 0 ? (
                <ul className="list-disc pl-4">
                  {(preview.changes ?? []).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  {preview.before?.when} → {preview.after?.when}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() => gbPost<{ ok: boolean; version: number }>(`responsibilities/${id}/apply`, { preview_id: preview.preview_id })).then((res) => {
                      if (!res) return
                      setPreview(null)
                      setDraft('')
                      setNote(`Saved as version ${res.version}.`)
                      void loadVersions()
                      onChanged()
                    })
                  }
                  className={buttonVariants({ size: 'xs' })}
                >
                  Apply
                </button>
                <button type="button" onClick={() => setPreview(null)} className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
          {versions && versions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Version history</p>
                {versions.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(() => gbPost(`responsibilities/${id}/undo`)).then((ok) => {
                        if (ok === null) return
                        setNote('Restored the previous version.')
                        void loadVersions()
                        onChanged()
                      })
                    }
                    className={buttonVariants({ variant: 'ghost', size: 'xs' })}
                  >
                    Undo last change
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-1 text-xs">
                {versions.slice(0, 5).map((v, i) => (
                  <li key={v.version} className="flex justify-between gap-3">
                    <span className="truncate">
                      v{v.version} · {displayName(v.name || r.name)}
                      {i === 0 ? ' · current' : ''}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{formatWhen(fromUnix(v.at))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link href="/app/agent-lab" className={cn(chatLink, 'self-start')}>
            Talk it through in chat
          </Link>
        </div>
      )}
    </OpsCard>
  )
}

export function ResponsibilitiesPage() {
  const { data, error, loading, reload } = useOverview()
  const week = useWeekStats()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [q, setQ] = useState('')
  const runs = data?.runs ?? []
  const questions = data?.questions ?? []
  const rows = useMemo(
    () => (data?.routines ?? []).map((r) => ({ r, status: responsibilityStatus(r, runs, questions), lastRun: runs.find((x) => x.routineId === r.id && !x.helper) })),
    [data, runs, questions],
  )
  const count = (s: ResponsibilityStatus) => rows.filter((x) => x.status === s).length
  const needle = q.trim().toLowerCase()
  const shown = rows
    .filter((x) => (filter === 'all' ? x.status !== 'finished' : x.status === filter))
    .filter((x) => !needle || `${displayName(x.r.name)} ${x.r.instruction ?? ''}`.toLowerCase().includes(needle))
  const options: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: rows.filter((x) => x.status !== 'finished').length },
    ...(['enabled', 'working', 'waiting', 'paused', 'blocked', 'failed'] as const)
      .filter((s) => count(s) > 0)
      .map((s) => ({ value: s, label: RESPONSIBILITY_STATUS[s].label, count: count(s) })),
  ]
  const active = rows.filter((x) => x.status !== 'paused' && x.status !== 'finished').length
  const routineRuns = week.items ? week.items.filter((i) => i.responsibility_id && i.kind !== 'upcoming').length : null
  const next = rows
    .filter((x) => !x.r.paused && !x.r.done && x.r.nextRunAt)
    .sort((a, b) => String(a.r.nextRunAt).localeCompare(String(b.r.nextRunAt)))[0]
  return (
    <OpsPage
      icon={ListChecks}
      title="Responsibilities"
      description="The ongoing work your agent owns, written in plain English. Pause one here, change it in words, or ask in chat."
      actions={<NewResponsibilityButton />}
    >
      {error && !data && <OpsError message={error} onRetry={reload} />}
      {data && <NeedsYouStrip questions={questions.length} failures={recentFailures(runs).length} />}
      {loading && !data ? (
        <OpsLoading />
      ) : data && data.routines === null ? (
        <OpsError message="Responsibilities are temporarily unavailable." onRetry={reload} />
      ) : rows.length === 0 ? (
        <OpsEmpty
          icon={ListChecks}
          title="No responsibilities yet"
          description="Tell your agent about something it should handle on its own, like “every weekday at 8am, text tomorrow's appointments a reminder.”"
          action={<NewResponsibilityButton />}
        />
      ) : (
        <>
          <KpiGrid cols={4}>
            <Kpi label="Active" value={active} icon={Repeat} tone={active ? 'success' : 'neutral'} sub={`of ${rows.filter((x) => x.status !== 'finished').length} responsibilities`} />
            <Kpi label="Paused" value={count('paused')} icon={PauseCircle} sub={count('paused') ? 'Turned off, nothing runs' : 'None paused'} />
            <Kpi label="Runs this week" value={routineRuns ?? '—'} icon={Activity} loading={routineRuns === null} sub="Scheduled and app-event runs" />
            <Kpi label="Next run" value={next ? formatWhen(next.r.nextRunAt).replace(/^(Today|Tomorrow), /, '') : '—'} icon={CalendarDays} sub={next ? displayName(next.r.name) : 'Nothing scheduled'} />
          </KpiGrid>
          <Toolbar>
            <Segmented value={filter} options={options} onChange={setFilter} />
            <SearchBox value={q} onChange={setQ} placeholder="Search responsibilities" />
          </Toolbar>
          {shown.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nothing matches that filter.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {shown.map((x) => (
                <ResponsibilityCard key={x.r.id} r={x.r} status={x.status} lastRun={x.lastRun} onChanged={reload} />
              ))}
            </div>
          )}
        </>
      )}
    </OpsPage>
  )
}

// ---------------- Activity ----------------

type GbActivity = {
  run_id: string
  title: string | null
  at: number | null
  created_at: number | null
  status: string
  summary: string | null
  source: string | null
  responsibility_id: string | null
  conversation_id: string | null
  warning: string | null
  evidence?: { files?: { path: string; name: string; size?: number }[]; connector_calls?: number; connector_failures?: number }
  grouped?: { count: number; first_at: number; last_at: number }
}

type ActFilter = 'all' | 'done' | 'warning' | 'working' | 'failed'

const ACT_STATE: Record<string, { label: string; tone: Tone; group: ActFilter }> = {
  done: { label: 'Done', tone: 'success', group: 'done' },
  completed_with_warning: { label: 'Completed with a warning', tone: 'warning', group: 'warning' },
  failed: { label: "Couldn't finish", tone: 'danger', group: 'failed' },
  stopped: { label: 'Stopped', tone: 'muted', group: 'done' },
  working: { label: 'Working', tone: 'info', group: 'working' },
  queued: { label: 'Queued', tone: 'info', group: 'working' },
}

const SOURCE_LABEL: Record<string, string> = { user: 'You asked', routine: 'Responsibility', webhook: 'App event', reminder: 'Reminder' }

function actState(s: string) {
  return ACT_STATE[s] ?? { label: displayName(s) || 'Done', tone: 'neutral' as Tone, group: 'done' as ActFilter }
}

function stripMd(t: string): string {
  return t.replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

function ActivityDrawer({ item, onClose }: { item: GbActivity | null; onClose: () => void }) {
  const st = item ? actState(item.status) : null
  const files = item?.evidence?.files ?? []
  return (
    <Drawer
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      title={item ? displayName(item.title) || 'Task' : ''}
      description={item ? formatWhen(fromUnix(item.at ?? item.created_at)) : undefined}
      footer={
        item && (
          <>
            <Link href={chatHref(item.conversation_id)} className={buttonVariants({ variant: 'default', size: 'sm' })}>
              Open chat
            </Link>
            <Link href="/app/agent-lab/files" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              All files
            </Link>
          </>
        )
      }
    >
      {item && st && (
        <div className="flex flex-col gap-5">
          <PropList
            items={[
              { label: 'Status', value: <Pill tone={st.tone}>{st.label}</Pill> },
              { label: 'Started by', value: SOURCE_LABEL[item.source ?? ''] ?? 'Your agent' },
              ...(item.evidence?.connector_calls ? [{ label: 'App actions', value: `${item.evidence.connector_calls}` }] : []),
              ...(item.grouped && item.grouped.count > 1 ? [{ label: 'Checks', value: `${item.grouped.count} runs found nothing new` }] : []),
            ]}
          />
          {item.warning && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              <span className="font-medium">Note: </span>
              {plainError(item.warning)}
            </div>
          )}
          {item.summary && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Result</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{stripMd(plainSummary(item.summary))}</p>
            </div>
          )}
          {files.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Files</h3>
              <ul className="flex flex-col gap-1.5">
                {files.map((f) => (
                  <li key={f.path}>
                    <a href={`/api/agent-lab/file?path=${encodeURIComponent(f.path)}&download=1`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <Download className="size-4 text-muted-foreground" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

export function ActivityPage() {
  const feed = usePolled<{ items: GbActivity[] }>(gbUrl('activity?limit=100&group=1'), 20_000)
  const week = useWeekStats()
  const [filter, setFilter] = useState<ActFilter>('all')
  const [source, setSource] = useState<string>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<GbActivity | null>(null)
  const items = feed.data?.items ?? []
  const needle = q.trim().toLowerCase()
  const shown = items.filter(
    (i) =>
      (filter === 'all' || actState(i.status).group === filter) &&
      (source === 'all' || i.source === source) &&
      (!needle || `${i.title ?? ''} ${i.summary ?? ''}`.toLowerCase().includes(needle)),
  )
  const c = (g: ActFilter) => items.filter((i) => actState(i.status).group === g).length
  const groups = useMemo(() => {
    const out: { day: string; rows: GbActivity[] }[] = []
    for (const i of shown) {
      const d = dayHeading(new Date((i.at ?? i.created_at ?? 0) * 1000))
      const last = out[out.length - 1]
      if (last && last.day === d) last.rows.push(i)
      else out.push({ day: d, rows: [i] })
    }
    return out
  }, [shown])
  const files = items.reduce((n, i) => n + (i.evidence?.files?.length ?? 0), 0)
  const t = week.stats?.totals
  return (
    <OpsPage icon={Activity} title="Activity" description="Your agent's work log: every run, what came of it, and what it tried when something failed.">
      <KpiGrid cols={4}>
        <Kpi label="Completed, 7 days" value={t ? t.done : '—'} icon={CheckCircle2} tone="success" loading={!t} spark={week.stats?.done} />
        <Kpi label="With a warning" value={t ? t.warning : '—'} icon={TriangleAlert} tone={t?.warning ? 'warning' : 'neutral'} loading={!t} sub="Finished, with a note" />
        <Kpi label="Couldn't finish" value={t ? t.failed : '—'} icon={CircleAlert} tone={t?.failed ? 'danger' : 'neutral'} loading={!t} sub="Last 7 days" />
        <Kpi label="Files made" value={feed.data ? files : '—'} icon={FileText} loading={!feed.data} sub="In the latest 100 runs" />
      </KpiGrid>
      {week.stats && (
        <Panel title="Work per day" action={<span className="text-xs text-muted-foreground">Last 7 days</span>}>
          <StackedColumns
            labels={week.stats.days.map((d) => d.label)}
            series={[
              { name: 'Done', values: week.stats.done, className: 'fill-primary' },
              { name: 'With a warning', values: week.stats.warning, className: 'fill-warning' },
              { name: "Couldn't finish", values: week.stats.failed, className: 'fill-destructive' },
            ]}
            height={140}
          />
        </Panel>
      )}
      {feed.error && !feed.data && <OpsError message={feed.error} onRetry={feed.reload} />}
      {feed.loading && !feed.data ? (
        <OpsLoading />
      ) : items.length === 0 ? (
        <OpsEmpty icon={Activity} title="No activity yet" description="Each task and responsibility run will be logged here with its result." />
      ) : (
        <>
          <Toolbar>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: items.length },
                { value: 'done', label: 'Done', count: c('done') },
                { value: 'warning', label: 'With a warning', count: c('warning') },
                { value: 'working', label: 'Working', count: c('working') },
                { value: 'failed', label: "Couldn't finish", count: c('failed') },
              ]}
            />
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: 'all', label: 'Any source' },
                { value: 'user', label: 'You asked' },
                { value: 'routine', label: 'Responsibility' },
                { value: 'webhook', label: 'App event' },
              ]}
            />
            <SearchBox value={q} onChange={setQ} placeholder="Search activity" />
          </Toolbar>
          {groups.length === 0 ? (
            <p className="rounded-card border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Nothing matches that filter.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((g) => (
                <section key={g.day} className="flex flex-col gap-2">
                  <h2 className="sticky top-14 z-10 -mx-1 bg-background/85 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">{g.day}</h2>
                  <ol className="relative flex flex-col rounded-card border border-border bg-card shadow-xs">
                    {g.rows.map((i) => {
                      const st = actState(i.status)
                      const nFiles = i.evidence?.files?.length ?? 0
                      const line = i.warning ? plainError(i.warning) : i.grouped && i.grouped.count > 1 ? `${i.grouped.count} checks found nothing new` : stripMd(plainSummary(i.summary)).split('\n')[0]
                      return (
                        <li key={i.run_id} className="border-b border-border/70 last:border-0">
                          <button type="button" onClick={() => setOpen(i)} className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40">
                            <span className="relative mt-1.5 flex flex-col items-center">
                              <Dot tone={st.tone} className="ring-4 ring-card" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="truncate text-sm font-medium">{displayName(i.title) || 'Task'}</span>
                                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{SOURCE_LABEL[i.source ?? ''] ?? 'Agent'}</span>
                              </span>
                              {line && <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">{line}</span>}
                              {(nFiles > 0 || (i.evidence?.connector_calls ?? 0) > 0) && (
                                <span className="mt-1.5 flex flex-wrap gap-1.5">
                                  {nFiles > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      <FileText className="size-3" /> {nFiles} file{nFiles === 1 ? '' : 's'}
                                    </span>
                                  )}
                                  {(i.evidence?.connector_calls ?? 0) > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      <Plug className="size-3" /> {i.evidence?.connector_calls} app action{i.evidence?.connector_calls === 1 ? '' : 's'}
                                    </span>
                                  )}
                                </span>
                              )}
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <Pill tone={st.tone}>{st.label}</Pill>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {new Date((i.at ?? i.created_at ?? 0) * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      <ActivityDrawer item={open} onClose={() => setOpen(null)} />
    </OpsPage>
  )
}

// ---------------- Calendar ----------------

const CAL_STYLE: Record<string, { label: string; cls: string; tone: Tone }> = {
  completed: { label: 'Done', cls: 'border-l-success bg-success/10', tone: 'success' },
  warning: { label: 'With a warning', cls: 'border-l-warning bg-warning/10', tone: 'warning' },
  failed: { label: "Couldn't finish", cls: 'border-l-destructive bg-destructive/10', tone: 'danger' },
  stopped: { label: 'Stopped', cls: 'border-l-muted-foreground/50 bg-muted/40', tone: 'muted' },
  working: { label: 'Working', cls: 'border-l-primary bg-primary/10', tone: 'info' },
  upcoming: { label: 'Upcoming', cls: 'border-l-primary border border-dashed border-primary/40 bg-card', tone: 'info' },
}

function startOfWeek(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
  return s
}

type CalRow = { at: number; title: string; kind: string; key: string; conversationId?: string | null }

export function CalendarPage() {
  const { data } = useOverview()
  const [offset, setOffset] = useState(0)
  const [view, setView] = useState<'week' | 'agenda'>('week')
  const [expanded, setExpanded] = useState<string | null>(null)
  const from = startOfWeek(new Date())
  from.setDate(from.getDate() + offset * 7)
  const fromTs = Math.floor(from.getTime() / 1000)
  const cal = usePolled<{ items: CalItem[] }>(gbUrl(`calendar?from=${fromTs}&to=${fromTs + 7 * 86400}&tasks=1`), 60_000)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    return d
  })
  const rows = useMemo<CalRow[]>(() => {
    const out: CalRow[] = (cal.data?.items ?? []).map((i, n) => ({ at: i.at, title: displayName(i.title) || 'Task', kind: i.kind, key: `${i.run_id ?? n}-${i.at}` }))
    // Upcoming runs of active responsibilities (the server list may not include them for future weeks).
    for (const r of data?.routines ?? []) {
      if (r.paused || r.done || !r.nextRunAt) continue
      const t = new Date(r.nextRunAt).getTime() / 1000
      if (t < fromTs || t >= fromTs + 7 * 86400) continue
      if (out.some((x) => x.kind === 'upcoming' && Math.abs(x.at - t) < 60)) continue
      out.push({ at: t, title: displayName(r.name) || 'Responsibility', kind: 'upcoming', key: `up-${r.id}` })
    }
    return out.sort((a, b) => a.at - b.at)
  }, [cal.data, data, fromTs])
  const byDay = days.map((d) => rows.filter((r) => new Date(r.at * 1000).toDateString() === d.toDateString()))
  const max = Math.max(1, ...byDay.map((x) => x.length))
  const today = new Date().toDateString()
  const upcoming = (data?.routines ?? [])
    .filter((r) => !r.paused && !r.done && r.nextRunAt)
    .sort((a, b) => String(a.nextRunAt).localeCompare(String(b.nextRunAt)))
    .slice(0, 8)
  const totals = (k: string) => rows.filter((r) => r.kind === k).length
  const time = (t: number) => new Date(t * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return (
    <OpsPage icon={CalendarDays} title="Calendar" description="What your agent did and what's coming up. Completed runs are solid; upcoming runs are outlined.">
      <Toolbar>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Previous week" onClick={() => setOffset(offset - 1)} className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}>
            <ChevronLeft />
          </button>
          <button type="button" onClick={() => setOffset(0)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Today
          </button>
          <button type="button" aria-label="Next week" onClick={() => setOffset(offset + 1)} className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}>
            <ChevronRight />
          </button>
          <span className="ml-2 text-base font-semibold">
            {days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="ml-auto">
          <Segmented value={view} onChange={setView} options={[{ value: 'week', label: 'Week' }, { value: 'agenda', label: 'Agenda' }]} />
        </div>
      </Toolbar>
      {cal.error && !cal.data && <OpsError message={cal.error} onRetry={cal.reload} />}
      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          {cal.loading && !cal.data ? (
            <OpsLoading rows={2} />
          ) : view === 'week' ? (
            <div className="overflow-x-auto rounded-card border border-border bg-card shadow-xs">
              <div className="grid min-w-[56rem] grid-cols-7 divide-x divide-border">
                {days.map((d, di) => {
                  const mine = byDay[di]
                  const key = d.toDateString()
                  const isToday = key === today
                  const limit = expanded === key ? mine.length : 7
                  return (
                    <div key={key} className={cn('flex min-h-[26rem] flex-col', isToday && 'bg-primary/[0.04]')}>
                      <div className="border-b border-border px-2.5 py-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <span className={cn('grid size-6 place-items-center rounded-full text-sm font-semibold tabular-nums', isToday && 'bg-primary text-primary-foreground')}>{d.getDate()}</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${(mine.length / max) * 100}%` }} />
                        </div>
                        <span className="mt-1 block text-[10px] text-muted-foreground tabular-nums">{mine.length ? `${mine.length} item${mine.length === 1 ? '' : 's'}` : 'Nothing'}</span>
                      </div>
                      <ul className="flex flex-1 flex-col gap-1 p-1.5">
                        {mine.slice(0, limit).map((e) => {
                          const st = CAL_STYLE[e.kind] ?? CAL_STYLE.completed
                          return (
                            <li key={e.key} title={`${st.label} · ${e.title}`} className={cn('rounded-md border-l-2 px-1.5 py-1 text-[11px] leading-tight', st.cls)}>
                              <span className="block text-[10px] text-muted-foreground tabular-nums">{time(e.at)}</span>
                              <span className="line-clamp-2 font-medium">{e.title}</span>
                            </li>
                          )
                        })}
                        {mine.length > 7 && (
                          <li>
                            <button type="button" onClick={() => setExpanded(expanded === key ? null : key)} className="w-full rounded-md px-1.5 py-1 text-left text-[11px] font-medium text-primary hover:bg-primary/10">
                              {expanded === key ? 'Show less' : `+${mine.length - 7} more`}
                            </button>
                          </li>
                        )}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {days.map((d, di) =>
                byDay[di].length === 0 ? null : (
                  <section key={d.toDateString()} className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dayHeading(d)}</h2>
                    <ul className="divide-y divide-border/70 rounded-card border border-border bg-card shadow-xs">
                      {byDay[di].map((e) => {
                        const st = CAL_STYLE[e.kind] ?? CAL_STYLE.completed
                        return (
                          <li key={e.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">{time(e.at)}</span>
                            <Dot tone={st.tone} />
                            <span className="min-w-0 flex-1 truncate">{e.title}</span>
                            <Pill tone={st.tone}>{st.label}</Pill>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ),
              )}
              {rows.length === 0 && <OpsEmpty icon={CalendarDays} title="Nothing this week" description="Runs and scheduled work will appear here." />}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="This week">
            <ul className="flex flex-col gap-2 text-sm">
              {(['completed', 'warning', 'failed', 'upcoming'] as const).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span className={cn('h-3 w-1 rounded-sm', CAL_STYLE[k].cls.split(' ')[0].replace('border-l-', 'bg-'))} />
                  <span className="flex-1 text-muted-foreground">{CAL_STYLE[k].label}</span>
                  <span className="font-medium tabular-nums">{totals(k)}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Coming up" bodyClassName="p-0">
            {upcoming.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nothing scheduled. Turn on a responsibility to see its next run here.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {upcoming.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="truncate font-medium">{displayName(r.name) || 'Responsibility'}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(r.nextRunAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </OpsPage>
  )
}

// ---------------- Assignments ----------------

function AssignmentCard({ r, onOpen }: { r: OpsRun; onOpen: () => void }) {
  const st = RUN_STATE_LABEL[runState(r.status)]
  const line = r.error ? plainError(r.error) : plainSummary(r.progress)
  return (
    <button type="button" onClick={onOpen} className={cn('w-full rounded-lg border border-l-[3px] border-border bg-card p-3 text-left shadow-xs transition hover:-translate-y-px hover:border-foreground/15', TONE_BAR[st.tone])}>
      <p className="line-clamp-2 text-sm font-medium">{displayName(r.title) || 'Task'}</p>
      {line && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{line}</p>}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{formatWhen(r.finishedAt ?? r.startedAt ?? r.createdAt)}</span>
        {runState(r.status) === 'working' && <Loader2 className="size-3 animate-spin text-primary" />}
      </div>
    </button>
  )
}

export function AssignmentsPage() {
  const { data, error, loading, reload } = useOverview()
  const [open, setOpen] = useState<OpsRun | null>(null)
  const list = assignments(data?.runs ?? [])
  const cols: { key: string; title: string; tone: Tone; rows: OpsRun[]; empty: string }[] = [
    { key: 'working', title: 'Working', tone: 'info', rows: list.filter((r) => runState(r.status) === 'working'), empty: 'Nothing running right now' },
    { key: 'waiting', title: 'Needs you', tone: 'warning', rows: list.filter((r) => runState(r.status) === 'waiting' || runState(r.status) === 'failed'), empty: 'Nothing waiting on you' },
    { key: 'done', title: 'Done', tone: 'success', rows: list.filter((r) => runState(r.status) === 'done'), empty: 'Finished work lands here' },
    { key: 'stopped', title: 'Stopped', tone: 'muted', rows: list.filter((r) => runState(r.status) === 'stopped'), empty: 'Nothing stopped' },
  ]
  const st = open ? RUN_STATE_LABEL[runState(open.status)] : null
  return (
    <OpsPage icon={BriefcaseBusiness} title="Assignments" description="One-off jobs you've given your agent in chat, separate from its ongoing responsibilities.">
      {error && !data && <OpsError message={error} onRetry={reload} />}
      {loading && !data ? (
        <OpsLoading />
      ) : data && data.runs === null ? (
        <OpsError message="Assignments are temporarily unavailable." onRetry={reload} />
      ) : list.length === 0 ? (
        <OpsEmpty
          icon={ClipboardList}
          title="No assignments yet"
          description="Ask your agent for something in chat, like “build a landing page and publish it,” and you can follow it here."
          action={
            <Link href="/app/agent-lab" className={buttonVariants({ variant: 'default' })}>
              Give an assignment
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cols.map((c) => (
            <section key={c.key} className="flex min-w-0 flex-col rounded-card border border-border bg-muted/30">
              <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <Dot tone={c.tone} />
                  {c.title}
                </span>
                <span className="rounded-md bg-background px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground ring-1 ring-border">{c.rows.length}</span>
              </header>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto px-2 pb-2">
                {c.rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">{c.empty}</p>
                ) : (
                  c.rows.map((r) => <AssignmentCard key={r.id} r={r} onOpen={() => setOpen(r)} />)
                )}
              </div>
            </section>
          ))}
        </div>
      )}
      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? displayName(open.title) || 'Task' : ''}
        description={open ? formatWhen(open.startedAt ?? open.createdAt) : undefined}
        footer={
          open && (
            <Link href={chatHref(open.conversationId)} className={buttonVariants({ variant: 'default', size: 'sm' })}>
              Open chat
            </Link>
          )
        }
      >
        {open && st && (
          <div className="flex flex-col gap-5">
            <PropList
              items={[
                { label: 'Status', value: <Pill tone={st.tone}>{st.label}</Pill> },
                { label: 'Started', value: formatWhen(open.startedAt ?? open.createdAt) },
                ...(open.finishedAt ? [{ label: 'Finished', value: formatWhen(open.finishedAt) }] : []),
                ...(open.attempts > 1 ? [{ label: 'Attempts', value: String(open.attempts) }] : []),
              ]}
            />
            {open.error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">{plainError(open.error)}</p>
            ) : open.progress ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{plainSummary(open.progress)}</p>
            ) : null}
          </div>
        )}
      </Drawer>
    </OpsPage>
  )
}
