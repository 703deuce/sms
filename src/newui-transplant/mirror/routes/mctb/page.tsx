import Link from 'next/link'
import { CheckCircle2, ChevronRight, Sparkles } from 'lucide-react'
import { Initials, Page, PageHeader, Panel, Pill, Rows, Stat, TextLink } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import { RecoveryPill } from '@/newui-transplant/components/app/status'
import { BUSINESS, CONVERSATIONS, MISSED_CALLS } from '@/newui-transplant/lib/sandbox-data'


const ACTIVITY = [
  { time: '10:35 AM', text: 'Rachel Kim replied to recovery text' },
  { time: '10:32 AM', text: 'Recovery text sent to Rachel Kim' },
  { time: '9:56 AM', text: 'Recovery text sent to Brandon Lee' },
  { time: '9:12 AM', text: '(512) 555-0100 suppressed — on exclusion list' },
]

export function TransplantMctbPage() {
  const needsReply = CONVERSATIONS.filter((c) => c.needsReply).length
  return (
    <Page>
      <PageHeader
        title="Overview"
        status={<Pill tone="success">Active</Pill>}
        description="Every missed call gets an instant text so the conversation keeps going."
        actions={<ButtonLink href="/mctb/setup" variant="outline">Manage setup</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Missed calls" value="87" delta={-6} hint="Last 7 days" href="/mctb/missed-calls" />
        <Stat label="Recovery texts sent" value="81" delta={9} hint="93% of eligible" href="/mctb/missed-calls" />
        <Stat label="Customer replies" value="52" delta={14} hint="64% reply rate" href="/mctb/conversations" />
        <Stat label="Needs reply" value={String(needsReply)} hint="Waiting on your team" href="/mctb/conversations" />
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            AI Recovery <Pill tone="success">On</Pill>
          </p>
          <p className="text-xs text-muted-foreground">
            Replies automatically, collects name, need, and location, then shares your booking link.
          </p>
        </div>
        <TextLink href="/mctb/ai-recovery">Manage</TextLink>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        Nothing needs attention. Forwarding, sender, and consent are all healthy.
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel
          title="Recent missed calls"
          action={<TextLink href="/mctb/missed-calls">View all</TextLink>}
          className="lg:col-span-3"
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 font-medium">Caller</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Missed</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Recovery</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Reply</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {MISSED_CALLS.slice(0, 5).map((m) => (
                  <tr key={m.id} className="relative hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <Link href={`/mctb/missed-calls/${m.id}`} className="font-medium after:absolute after:inset-0">
                        {m.caller}
                      </Link>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{m.missed}</td>
                    <td className="px-3 py-3"><RecoveryPill status={m.recovery} /></td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-muted-foreground">{m.reply ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Recent conversations"
          action={<TextLink href="/mctb/conversations">Open inbox</TextLink>}
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {CONVERSATIONS.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link href={`/mctb/conversations?conversation=${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                  <Initials name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {c.name}
                      {c.unread ? <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" /> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.time}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Setup status" action={<TextLink href="/mctb/setup">Setup</TextLink>}>
          <Rows
            items={[
              { label: 'Business line', value: <span className="font-mono text-xs">{BUSINESS.line}</span>, href: '/mctb/setup/phone' },
              { label: 'Forwarding', value: <Pill tone="success">Verified</Pill>, href: '/mctb/setup/phone' },
              { label: 'Sender', value: <span className="font-mono text-xs">{BUSINESS.sender}</span>, href: '/mctb/setup/text-back' },
              { label: 'Consent mode', value: 'Press 1', href: '/mctb/setup/consent' },
              { label: 'Recovery pause', value: 'Not paused', href: '/mctb/setup/recovery' },
            ]}
          />
        </Panel>
        <Panel title="Recent activity">
          <ol className="flex flex-col gap-3">
            {ACTIVITY.map((a) => (
              <li key={a.text} className="flex gap-3 text-sm">
                <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{a.time}</span>
                <span className="flex-1 text-pretty">{a.text}</span>
                <ChevronRight className="size-4 text-muted-foreground/50" aria-hidden="true" />
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </Page>
  )
}
