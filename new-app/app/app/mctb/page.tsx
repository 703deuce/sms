import Link from 'next/link'
import { MessageSquareText, Settings2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Page, PageHeader, Panel, Stat } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { RecentCalls } from '@/components/calls/recent-calls'
import { CALLS, MCTB_FUNNEL, THREADS, getContact } from '@/lib/data'
import { formatWhen } from '@/lib/format'
import { mctbMetrics, pct } from '@/lib/metrics'

export const metadata = { title: 'Missed Call Text Back' }

export default function McTbOverview() {
  const m = mctbMetrics()
  const mctbCalls = CALLS.filter((c) => c.mctb)
  const waiting = THREADS.filter((t) => t.kind === 'mctb' && t.needsReply)
  const top = MCTB_FUNNEL[0].value

  return (
    <Page>
      <PageHeader
        eyebrow={<StatusBadge tone="success">Recovery on · 2 lines</StatusBadge>}
        title="Missed Call Text Back"
        description="When nobody — human or AI — picks up, callers can press 1 to get a text so the conversation continues."
        actions={
          <>
            <Link href="/app/mctb/recovery" className={buttonVariants({ variant: 'outline' })}>
              <Settings2 />
              Recovery settings
            </Link>
            <Link href="/app/mctb/conversations" className={buttonVariants()}>
              <MessageSquareText />
              Conversations
            </Link>
          </>
        }
      />

      <section aria-label="Last 7 days" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Missed calls" value={m.missed} href="/app/mctb/calls" />
        <Stat label="Consent rate" value={pct(m.consented, m.offered)} hint={`${m.consented} of ${m.offered} offered`} />
        <Stat label="Delivered" value={m.delivered} tone="success" />
        <Stat label="Replied" value={m.replied} tone="success" href="/app/mctb/conversations" />
        <Stat label="Needs callback" value={m.needsCallback} tone="warning" href="/app/mctb/calls?filter=needs_callback" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Recovery funnel" description="Last 30 days · each step measured, not inferred" className="lg:col-span-2">
          <ol className="flex flex-col gap-3">
            {MCTB_FUNNEL.map((s) => (
              <li key={s.stage} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_4rem]">
                <span className="flex flex-col">
                  <span className="font-medium">{s.stage}</span>
                  <span className="text-[11px] text-muted-foreground">{s.note}</span>
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(s.value / top) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums">
                  {s.value} <span className="text-xs text-muted-foreground">{pct(s.value, top)}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Waiting on you" description={`${waiting.length} replies need a response`} bodyClassName="p-0">
          <ul className="divide-y">
            {waiting.map((t) => {
              const c = getContact(t.contactId)
              const last = t.messages.filter((x) => x.from === 'customer').at(-1)
              return (
                <li key={t.id}>
                  <Link href={`/app/mctb/conversations?thread=${t.id}`} className="flex flex-col gap-1 px-5 py-3 hover:bg-muted/60">
                    <span className="flex items-center justify-between text-sm font-medium">
                      {c?.name}
                      <span className="text-xs font-normal text-muted-foreground">{last && formatWhen(last.at)}</span>
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{last?.text}</span>
                  </Link>
                </li>
              )
            })}
            {waiting.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">All caught up.</li>}
          </ul>
        </Panel>
      </div>

      <RecentCalls calls={mctbCalls.slice(0, 6)} basePath="/app/mctb/calls" viewAllHref="/app/mctb/calls" title="Recent missed calls" focus="mctb" />
    </Page>
  )
}
