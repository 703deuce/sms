'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Folder,
  Inbox,
  ListChecks,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Plug,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { Page, Stat } from '@/components/app/page-primitives'
import { buttonVariants } from '@/components/ui/button'
import { chatHref, dashboardSummary, displayName, formatWhen, runState, type OpsRun } from '@/lib/agent-lab/ops'
import { cn } from '@/lib/utils'
import { gbUrl } from './gb14'
import { NotificationsBell, OpsCard, OpsError, OpsLoading, SectionHeading } from './ops-ui'
import { useOverview, usePolled } from './use-ops-data'

type Conversation = { id: string; title: string; status: string; createdAt: string | null; updatedAt: string | null }

const QUICK_LINKS = [
  { label: 'Needs you', href: '/app/agent-lab/needs-you', icon: Inbox },
  { label: 'Responsibilities', href: '/app/agent-lab/responsibilities', icon: ListChecks },
  { label: 'Activity', href: '/app/agent-lab/activity', icon: Activity },
  { label: 'Connections', href: '/app/agent-lab/connections', icon: Plug },
  { label: 'Files', href: '/app/agent-lab/files', icon: Folder },
] as const

const STARTERS = [
  'Every weekday at 8am, send me a summary of new emails that need a reply',
  'Watch my competitors’ pricing pages and tell me when anything changes',
  'Find 20 local businesses that could use our service and draft intros',
]

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/** Big chat box: starts a new conversation through the same start path the chat page uses, then opens it. */
function StartChat() {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  async function start() {
    const message = draft.trim()
    if (!message || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/agent-lab/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, timezone: browserTimeZone() }),
      })
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
      if (!res.ok || !data.id) throw new Error(data.error || 'Your agent could not start this chat. Try again in a moment.')
      router.push(chatHref(data.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-primary opacity-[0.10] blur-3xl" />
      <div className="relative px-4 pt-6 pb-4 sm:px-8 sm:pt-9">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Sparkles className="size-3.5 text-primary" />
          {greeting()}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">What should your agent take care of?</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Ask for something once, or give it a responsibility to keep doing. It works in the background and tells you what it finds.
        </p>
        <form
          className="mt-5 rounded-xl border border-input bg-background shadow-xs transition-shadow focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
          onSubmit={(e) => {
            e.preventDefault()
            void start()
          }}
        >
          <label htmlFor="dashboard-chat" className="sr-only">
            Message your agent
          </label>
          <textarea
            id="dashboard-chat"
            ref={ref}
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void start()
              }
            }}
            rows={3}
            placeholder="Describe a task or a responsibility…"
            className="block max-h-64 min-h-24 w-full resize-none bg-transparent px-4 pt-3.5 text-base outline-none field-sizing-content placeholder:text-muted-foreground disabled:opacity-60 sm:text-[15px]"
          />
          <div className="flex items-center justify-between gap-3 px-3 pb-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">Enter to send · Shift+Enter for a new line</span>
            <button
              type="submit"
              disabled={!draft.trim() || busy}
              className={cn(buttonVariants({ size: 'sm' }), 'ml-auto gap-1.5 rounded-lg shadow-sm disabled:opacity-50')}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              {busy ? 'Starting…' : 'Start chat'}
            </button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setDraft(s)
                ref.current?.focus()
              }}
              className="max-w-full truncate rounded-full border border-border bg-background/70 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <nav aria-label="Quick links" className="relative flex gap-2 overflow-x-auto border-t border-border bg-muted/30 px-4 py-3 sm:px-8">
        {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium shadow-xs transition-all hover:-translate-y-px hover:border-foreground/20"
          >
            <Icon className="size-4 text-primary" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

function ResultRow({ run }: { run: OpsRun }) {
  const failed = runState(run.status) === 'failed'
  return (
    <li>
      <Link href={chatHref(run.conversationId)} className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
        {failed ? <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{displayName(run.title) || 'Task'}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {failed ? run.error || 'Did not finish' : run.progress || 'Finished'}
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(run.finishedAt ?? run.createdAt)}</span>
      </Link>
    </li>
  )
}

export function AgentDashboard() {
  const overview = useOverview()
  const convs = usePolled<{ conversations: Conversation[] }>('/api/agent-lab/conversations', 30_000)
  // GB-14 approvals and permission changes; absent until that API is live, then they count toward "Needs you".
  const appr = usePolled<{ items: unknown[] }>(gbUrl('permissions/approvals?status=pending'), 30_000)
  const changes = usePolled<{ items: unknown[] }>(gbUrl('permissions/pending-changes'), 60_000)

  const o = overview.data
  const s = useMemo(() => (o ? dashboardSummary(o) : null), [o])
  const approvals = (appr.data?.items?.length ?? 0) + (changes.data?.items?.length ?? 0)
  const needsYou = s ? s.openQuestions + s.failures.length + approvals : approvals
  const unavailable = o && o.runs === null && o.routines === null

  return (
    <Page fluid>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-end gap-2">
          <NotificationsBell />
          <Link href="/app/agent-lab" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
            <MessagesSquare className="size-4" />
            All chats
          </Link>
        </div>

        <StartChat />

        <section aria-label="What's happening" className="flex flex-col gap-3">
          <SectionHeading title="What's happening" />
          {overview.error && !o ? (
            <OpsError message={overview.error} onRetry={overview.reload} />
          ) : unavailable ? (
            <OpsError message="Your agent's status is unavailable right now." onRetry={overview.reload} />
          ) : !s ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Active responsibilities"
                value={s.activeResponsibilities}
                icon={ListChecks}
                href="/app/agent-lab/responsibilities"
                hint={s.pausedResponsibilities ? `${s.pausedResponsibilities} paused` : s.activeResponsibilities ? 'Running on schedule' : 'None yet. Ask in chat to add one.'}
              />
              <Stat
                label="Needs you"
                value={needsYou}
                icon={Inbox}
                tone={needsYou ? 'warning' : 'success'}
                href="/app/agent-lab/needs-you"
                hint={needsYou ? 'Questions, approvals or failed runs' : 'Nothing waiting on you'}
              />
              <Stat
                label="Working now"
                value={s.workingNow}
                icon={Activity}
                href="/app/agent-lab/activity"
                hint={s.quietChecks ? `${s.quietChecks} quiet check${s.quietChecks === 1 ? '' : 's'} today, nothing new` : 'Tasks running in the background'}
              />
              <Stat
                label="Next up"
                value={s.nextUp ? formatWhen(s.nextUp.at).replace(/^(Today|Tomorrow), /, '') : '—'}
                icon={CalendarClock}
                href="/app/agent-lab/calendar"
                hint={s.nextUp ? `${formatWhen(s.nextUp.at).startsWith('Tomorrow') ? 'Tomorrow · ' : ''}${displayName(s.nextUp.title)}` : 'Nothing scheduled'}
              />
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-5">
          <section aria-label="Recent conversations" className="flex min-w-0 flex-col gap-3 lg:col-span-3">
            <SectionHeading
              title="Recent conversations"
              action={
                <Link href="/app/agent-lab" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Open chat <ArrowRight className="size-3" />
                </Link>
              }
            />
            <OpsCard className="p-2">
              {convs.loading && !convs.data ? (
                <OpsLoading rows={3} />
              ) : convs.error && !convs.data ? (
                <OpsError message={convs.error} onRetry={convs.reload} />
              ) : !convs.data?.conversations.length ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <MessageSquare className="size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">No conversations yet</p>
                  <p className="text-sm text-muted-foreground">Start one above. Your chats will show up here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {convs.data.conversations.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <Link href={chatHref(c.id)} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <MessageSquare className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{displayName(c.title)}</span>
                          <span className="block text-xs text-muted-foreground">{formatWhen(c.updatedAt ?? c.createdAt)}</span>
                        </span>
                        {c.status === 'running' && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            <Loader2 className="size-3 animate-spin" /> Working
                          </span>
                        )}
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </OpsCard>
          </section>

          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            {s && (needsYou > 0 || s.failures.length > 0) && (
              <section aria-label="Needs attention" className="flex flex-col gap-3">
                <SectionHeading title="Needs attention" count={needsYou} />
                <OpsCard className="flex flex-col gap-2 border-warning/40">
                  {s.openQuestions > 0 && (
                    <Link href="/app/agent-lab/needs-you" className="flex items-center gap-2 text-sm hover:underline">
                      <CircleAlert className="size-4 text-warning-foreground" />
                      {s.openQuestions} question{s.openQuestions === 1 ? '' : 's'} waiting for your answer
                    </Link>
                  )}
                  {approvals > 0 && (
                    <Link href="/app/agent-lab/needs-you" className="flex items-center gap-2 text-sm hover:underline">
                      <CircleAlert className="size-4 text-warning-foreground" />
                      {approvals} permission request{approvals === 1 ? '' : 's'} to review
                    </Link>
                  )}
                  {s.failures.length > 0 && (
                    <Link href="/app/agent-lab/needs-you" className="flex items-center gap-2 text-sm hover:underline">
                      <XCircle className="size-4 text-destructive" />
                      {s.failures.length} run{s.failures.length === 1 ? '' : 's'} didn&apos;t finish in the last 3 days
                    </Link>
                  )}
                </OpsCard>
              </section>
            )}

            <section aria-label="Recent results" className="flex flex-col gap-3">
              <SectionHeading
                title="Recent results"
                action={
                  <Link href="/app/agent-lab/activity" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    All activity <ArrowRight className="size-3" />
                  </Link>
                }
              />
              <OpsCard className="p-2">
                {unavailable || (overview.error && !o) ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">Results are unavailable right now.</p>
                ) : !s ? (
                  <OpsLoading rows={2} />
                ) : s.recentResults.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {s.quietChecks ? 'Checks ran and found nothing new.' : 'Finished work will show up here.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {s.recentResults.map((r) => (
                      <ResultRow key={r.id} run={r} />
                    ))}
                  </ul>
                )}
              </OpsCard>
            </section>
          </div>
        </div>
      </div>
    </Page>
  )
}
