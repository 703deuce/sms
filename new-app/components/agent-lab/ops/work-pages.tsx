'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Inbox,
  ListChecks,
  Plus,
  Sparkles,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  RESPONSIBILITY_STATUS,
  RUN_STATE_LABEL,
  assignments,
  calendarEntries,
  cronToWords,
  displayName,
  formatWhen,
  groupActivity,
  responsibilityStatus,
  runState,
  type CalendarEntry,
  type OpsQuestion,
  type OpsRoutine,
  type OpsRun,
  type ResponsibilityStatus,
} from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'
import { fromUnix, gbPost, gbUrl, type Approval, type PendingChange, type Version } from './gb14'
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

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
            value === o.value ? 'border-foreground/20 bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
          {typeof o.count === 'number' && <span className="tabular-nums opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
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

export function NeedsYouPage() {
  const { data, error, loading, reload } = useOverview()
  const appr = usePolled<{ items: Approval[] }>(gbUrl('permissions/approvals?status=pending'), 15_000)
  const changes = usePolled<{ items: PendingChange[] }>(gbUrl('permissions/pending-changes'), 30_000)
  const approvals = (appr.data?.items ?? []).filter((a) => a.status === 'pending' || !a.status)
  const pendingChanges = (changes.data?.items ?? []).filter((c) => c.status === 'pending' || !c.status)
  const questions = data?.questions ?? []
  const failures = recentFailures(data?.runs ?? [])
  return (
    <OpsPage icon={Inbox} title="Needs you" description="Only what your agent can't decide or couldn't fix. Work you've already authorized never waits here.">
      {error && !data && <OpsError message={error} onRetry={reload} />}
      {loading && !data ? (
        <OpsLoading />
      ) : data && data.questions === null && data.runs === null ? (
        <OpsError message="This list is temporarily unavailable." onRetry={reload} />
      ) : questions.length === 0 && failures.length === 0 && approvals.length === 0 && pendingChanges.length === 0 ? (
        <OpsEmpty icon={Sparkles} title="Nothing needs you" description="Your agent is handling everything on its own. Questions and anything it couldn't finish will show up here." />
      ) : (
        <>
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
          {failures.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeading title="Couldn't finish" count={failures.length} />
              <OpsCard className="divide-y divide-border p-0">
                {failures.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{displayName(r.title) || 'Task'}</p>
                      {r.error && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.error}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatWhen(r.finishedAt ?? r.createdAt)}</p>
                    </div>
                    <Link href="/app/agent-lab" className={chatLink}>
                      Ask in chat
                    </Link>
                  </div>
                ))}
              </OpsCard>
            </section>
          )}
        </>
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
    <OpsCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-semibold">{displayName(r.name) || 'Responsibility'}</p>
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
                {lastRun.error ? ` · ${lastRun.error}` : lastRun.progress ? ` · ${lastRun.progress}` : ''}
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
  const [filter, setFilter] = useState<StatusFilter>('all')
  const runs = data?.runs ?? []
  const questions = data?.questions ?? []
  const rows = useMemo(
    () => (data?.routines ?? []).map((r) => ({ r, status: responsibilityStatus(r, runs, questions), lastRun: runs.find((x) => x.routineId === r.id && !x.helper) })),
    [data, runs, questions],
  )
  const count = (s: ResponsibilityStatus) => rows.filter((x) => x.status === s).length
  const shown = rows.filter((x) => (filter === 'all' ? x.status !== 'finished' : x.status === filter))
  const options: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: rows.filter((x) => x.status !== 'finished').length },
    ...(['enabled', 'working', 'waiting', 'paused', 'blocked', 'failed'] as const)
      .filter((s) => count(s) > 0)
      .map((s) => ({ value: s, label: RESPONSIBILITY_STATUS[s].label, count: count(s) })),
  ]
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
          <Chips value={filter} options={options} onChange={setFilter} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((x) => (
              <ResponsibilityCard key={x.r.id} r={x.r} status={x.status} lastRun={x.lastRun} onChanged={reload} />
            ))}
          </div>
        </>
      )}
    </OpsPage>
  )
}

// ---------------- Activity ----------------

type ActFilter = 'all' | 'done' | 'working' | 'waiting' | 'failed'

function RunRow({ run, name }: { run: OpsRun; name: string | null }) {
  const [open, setOpen] = useState(false)
  const st = RUN_STATE_LABEL[runState(run.status)]
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayName(name || run.title) || 'Task'}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {formatWhen(run.finishedAt ?? run.startedAt ?? run.createdAt)}
            {run.error ? ` · ${run.error}` : run.progress ? ` · ${run.progress}` : ''}
          </p>
        </div>
        <Pill tone={st.tone}>{st.label}</Pill>
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-4 pb-3 text-xs text-muted-foreground">
          {name && run.title && run.title !== name && <p>{displayName(run.title)}</p>}
          {run.progress && <p>Latest: {run.progress}</p>}
          {run.error && <p className="text-destructive">What went wrong: {run.error}</p>}
          <p>
            Started {formatWhen(run.startedAt ?? run.createdAt)}
            {run.finishedAt ? ` · finished ${formatWhen(run.finishedAt)}` : ''}
            {run.attempts > 1 ? ` · ${run.attempts} attempts` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/agent-lab" className={chatLink}>
              Open chat
            </Link>
            <Link href="/app/agent-lab/files" className={chatLink}>
              Files
            </Link>
          </div>
        </div>
      )}
    </li>
  )
}

export function ActivityPage() {
  const { data, error, loading, reload } = useOverview()
  const [filter, setFilter] = useState<ActFilter>('all')
  const [openQuiet, setOpenQuiet] = useState<string | null>(null)
  const names = useMemo(() => new Map((data?.routines ?? []).map((r) => [r.id, r.name])), [data])
  const runs = (data?.runs ?? []).filter((r) => !r.helper)
  const match = (r: OpsRun) => filter === 'all' || runState(r.status) === (filter === 'working' ? 'working' : filter)
  const groups = groupActivity(runs.filter(match), (id) => names.get(id) ?? null)
  const c = (s: ReturnType<typeof runState>) => runs.filter((r) => runState(r.status) === s).length
  return (
    <OpsPage icon={Activity} title="Activity" description="Your agent's work log: every run, what came of it, and what it tried when something failed.">
      {error && !data && <OpsError message={error} onRetry={reload} />}
      {loading && !data ? (
        <OpsLoading />
      ) : data && data.runs === null ? (
        <OpsError message="Activity is temporarily unavailable." onRetry={reload} />
      ) : runs.length === 0 ? (
        <OpsEmpty icon={Activity} title="No activity yet" description="Each task and responsibility run will be logged here with its result." />
      ) : (
        <>
          <Chips
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: runs.length },
              { value: 'done', label: 'Done', count: c('done') },
              { value: 'working', label: 'Working', count: c('working') },
              { value: 'waiting', label: 'Needs you', count: c('waiting') },
              { value: 'failed', label: 'Failed', count: c('failed') },
            ]}
          />
          <OpsCard className="p-0">
            <ul className="divide-y divide-border">
              {groups.map((g) =>
                g.kind === 'run' ? (
                  <RunRow key={g.run.id} run={g.run} name={g.run.routineId ? names.get(g.run.routineId) ?? null : null} />
                ) : g.runs.length === 1 ? (
                  <RunRow key={g.runs[0].id} run={g.runs[0]} name={g.title} />
                ) : (
                  <li key={`q-${g.runs[0].id}`}>
                    <button
                      type="button"
                      onClick={() => setOpenQuiet(openQuiet === g.runs[0].id ? null : g.runs[0].id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {displayName(g.title)}: {g.runs.length} checks found nothing new
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatWhen(g.runs[g.runs.length - 1].createdAt)} to {formatWhen(g.runs[0].createdAt)}
                        </p>
                      </div>
                      <Pill tone="muted">Grouped</Pill>
                    </button>
                    {openQuiet === g.runs[0].id && (
                      <ul className="border-t border-border bg-muted/20">
                        {g.runs.map((r) => (
                          <RunRow key={r.id} run={r} name={g.title} />
                        ))}
                      </ul>
                    )}
                  </li>
                ),
              )}
            </ul>
          </OpsCard>
        </>
      )}
    </OpsPage>
  )
}

// ---------------- Calendar ----------------

const STATE_STYLE: Record<CalendarEntry['state'], { label: string; cls: string }> = {
  done: { label: 'Done', cls: 'border-success/40 bg-success/10' },
  failed: { label: 'Failed', cls: 'border-destructive/40 bg-destructive/10' },
  working: { label: 'Working', cls: 'border-primary/40 bg-primary/10' },
  waiting: { label: 'Needs you', cls: 'border-warning/40 bg-warning/10' },
  stopped: { label: 'Stopped', cls: 'border-border bg-muted/40' },
  upcoming: { label: 'Upcoming', cls: 'border-dashed border-primary/50 bg-card' },
}

function startOfWeek(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
  return s
}

export function CalendarPage() {
  const { data, error, loading, reload } = useOverview()
  const [offset, setOffset] = useState(0)
  const from = startOfWeek(new Date())
  from.setDate(from.getDate() + offset * 7)
  const to = new Date(from)
  to.setDate(from.getDate() + 7)
  const entries = data ? calendarEntries(data, from, to) : []
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    return d
  })
  const today = new Date().toDateString()
  const upcoming = (data?.routines ?? [])
    .filter((r) => !r.paused && !r.done && r.nextRunAt)
    .sort((a, b) => String(a.nextRunAt).localeCompare(String(b.nextRunAt)))
    .slice(0, 8)
  return (
    <OpsPage icon={CalendarDays} title="Calendar" description="What your agent did and what's coming up. Completed runs are solid; upcoming runs are outlined.">
      {error && !data && <OpsError message={error} onRetry={reload} />}
      {loading && !data ? (
        <OpsLoading rows={2} />
      ) : data && data.runs === null && data.routines === null ? (
        <OpsError message="The calendar is temporarily unavailable." onRetry={reload} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous week" onClick={() => setOffset(offset - 1)} className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}>
                <ChevronLeft />
              </button>
              <button type="button" onClick={() => setOffset(0)} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                This week
              </button>
              <button type="button" aria-label="Next week" onClick={() => setOffset(offset + 1)} className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}>
                <ChevronRight />
              </button>
              <span className="ml-1 text-sm font-medium">
                {days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {(['done', 'working', 'failed', 'upcoming'] as const).map((s) => (
                <span key={s} className={cn('rounded-md border px-1.5 py-0.5', STATE_STYLE[s].cls)}>
                  {STATE_STYLE[s].label}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
            {days.map((d) => {
              const mine = entries.filter((e) => new Date(e.at).toDateString() === d.toDateString())
              return (
                <div key={d.toISOString()} className={cn('min-h-36 rounded-card border border-border bg-card p-2', d.toDateString() === today && 'ring-2 ring-primary/40')}>
                  <p className="mb-2 text-xs font-semibold">
                    {d.toLocaleDateString('en-US', { weekday: 'short' })} <span className="text-muted-foreground">{d.getDate()}</span>
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {mine.slice(0, 6).map((e, i) => (
                      <li key={`${e.at}-${i}`} className={cn('rounded-md border px-1.5 py-1 text-[11px] leading-tight', STATE_STYLE[e.state].cls)}>
                        <span className="block font-medium">{STATE_STYLE[e.state].label}</span>
                        <span className="block truncate" title={displayName(e.title)}>
                          {new Date(e.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {displayName(e.title)}
                        </span>
                      </li>
                    ))}
                    {mine.length > 6 && <li className="text-[11px] text-muted-foreground">+{mine.length - 6} more</li>}
                  </ul>
                </div>
              )
            })}
          </div>
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeading title="Coming up" count={upcoming.length} />
              <OpsCard className="divide-y divide-border p-0">
                {upcoming.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="truncate font-medium">{displayName(r.name) || 'Responsibility'}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(r.nextRunAt)}</span>
                  </div>
                ))}
              </OpsCard>
            </section>
          )}
        </>
      )}
    </OpsPage>
  )
}

// ---------------- Assignments ----------------

export function AssignmentsPage() {
  const { data, error, loading, reload } = useOverview()
  const list = assignments(data?.runs ?? [])
  const active = list.filter((r) => runState(r.status) === 'working' || runState(r.status) === 'waiting')
  const rest = list.filter((r) => !active.includes(r))
  const block = (title: string, rows: OpsRun[]) =>
    rows.length > 0 && (
      <section className="flex flex-col gap-3">
        <SectionHeading title={title} count={rows.length} />
        <OpsCard className="p-0">
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <RunRow key={r.id} run={r} name={null} />
            ))}
          </ul>
        </OpsCard>
      </section>
    )
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
        <>
          {block('In progress', active)}
          {block('Finished', rest)}
        </>
      )}
    </OpsPage>
  )
}
