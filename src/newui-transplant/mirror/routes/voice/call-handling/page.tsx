import { Bot, GripVertical, Plus, User } from 'lucide-react'
import { FieldRow, Page, PageHeader, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Switch } from '@/newui-transplant/components/ui/switch'

export const metadata: Metadata = { title: 'Call Handling' }

const TRANSFERS = [
  { name: 'Front office', number: '(512) 555-0142', ring: '20s', status: 'Verified' },
  { name: 'Jake — Service manager', number: '(512) 555-0170', ring: '15s', status: 'Verified' },
  { name: 'On-call tech', number: '(737) 555-0184', ring: '25s', status: 'Unverified' },
]

const RECENT = [
  { caller: 'Unknown caller', to: 'On-call tech', reason: 'Emergency: burst pipe', time: 'Today 9:31 AM', result: 'Answered' },
  { caller: 'Linda Park', to: 'Front office', reason: 'Billing question', time: 'Yesterday 2:10 PM', result: 'Answered' },
  { caller: 'Carl Mendez', to: 'Jake — Service manager', reason: 'Asked for manager', time: 'Sep 23 11:48 AM', result: 'No answer → voicemail' },
]

export function TransplantVoiceCallHandlingPage() {
  return (
    <Page>
      <PageHeader
        title="Call Handling"
        description="Decide who answers, when calls transfer, and how emergencies are routed."
        actions={<Button>Save changes</Button>}
      />

      <section aria-labelledby="current" className="mb-6 grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <h2 id="current" className="sr-only">Current behavior</h2>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <User className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">During business hours</p>
            <p className="text-sm font-semibold">Team rings first, AI after 20s</p>
          </div>
        </div>
        <div className="hidden h-10 w-px bg-border sm:block" />
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent">
            <Bot className="size-5 text-accent-foreground" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">After hours — right now</p>
            <p className="flex items-center gap-2 text-sm font-semibold">
              AI answers immediately <Pill tone="success">Live</Pill>
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Transfers"
          description="Tried in order until someone picks up"
          action={
            <Button size="sm" variant="outline">
              <Plus /> Add target
            </Button>
          }
          bodyClassName="p-0"
          className="lg:col-span-2"
        >
          <ol className="divide-y">
            {TRANSFERS.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3 px-5 py-3">
                <GripVertical className="size-4 text-muted-foreground/50" aria-hidden="true" />
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{t.number}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:inline">Ring {t.ring}</span>
                <Pill tone={t.status === 'Verified' ? 'success' : 'warning'}>{t.status}</Pill>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Business hours & after hours">
          <div className="divide-y">
            <FieldRow label="Ring team first during hours" description="AI picks up if nobody answers in 20 seconds">
              <Switch defaultChecked aria-label="Ring team first" />
            </FieldRow>
            <FieldRow label="AI answers after hours" description="Books visits and takes messages when closed">
              <Switch defaultChecked aria-label="AI after hours" />
            </FieldRow>
            <FieldRow label="Holiday schedule" description="Uses US federal holidays">
              <Switch aria-label="Holiday schedule" />
            </FieldRow>
          </div>
        </Panel>

        <Panel title="On-call">
          <div className="divide-y">
            <FieldRow label="On-call rotation" description="This week: Marco R. · (737) 555-0184">
              <Button size="sm" variant="outline">Edit</Button>
            </FieldRow>
            <FieldRow label="Only transfer emergencies after hours">
              <Switch defaultChecked aria-label="Emergencies only after hours" />
            </FieldRow>
          </div>
        </Panel>

        <Panel title="Emergency & urgent calls">
          <p className="mb-3 text-xs text-muted-foreground">Keywords that trigger immediate transfer to on-call</p>
          <div className="flex flex-wrap gap-1.5">
            {['burst pipe', 'flooding', 'gas smell', 'no heat', 'sewage backup', 'carbon monoxide'].map((k) => (
              <span key={k} className="rounded-md border bg-muted/50 px-2 py-1 text-xs">{k}</span>
            ))}
            <button type="button" className="rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              + Add
            </button>
          </div>
        </Panel>

        <Panel title="Transfer notifications">
          <div className="divide-y">
            <FieldRow label="Whisper caller context" description="Ava briefs the teammate before connecting">
              <Switch defaultChecked aria-label="Whisper" />
            </FieldRow>
            <FieldRow label="Text summary to teammate">
              <Switch defaultChecked aria-label="Text summary" />
            </FieldRow>
          </div>
        </Panel>

        <Panel title="Caller protection">
          <div className="divide-y">
            <FieldRow label="Block spam & robocalls" description="142 calls blocked this month">
              <Switch defaultChecked aria-label="Block spam" />
            </FieldRow>
            <FieldRow label="Politely decline solicitors">
              <Switch defaultChecked aria-label="Decline solicitors" />
            </FieldRow>
          </div>
        </Panel>

        <Panel title="Call recording">
          <div className="divide-y">
            <FieldRow label="Record calls" description="Plays a short disclosure at the start of each call">
              <Switch defaultChecked aria-label="Record calls" />
            </FieldRow>
            <FieldRow label="Retention" description="Recordings are deleted after 90 days">
              <Button size="sm" variant="outline">Change</Button>
            </FieldRow>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4" title="Recent transfers" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-2.5 font-medium">Caller</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Transferred to</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Reason</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Time</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {RECENT.map((r) => (
                <tr key={r.time}>
                  <td className="px-5 py-3 font-medium">{r.caller}</td>
                  <td className="px-3 py-3">{r.to}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.reason}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{r.time}</td>
                  <td className="px-3 py-3">
                    <Pill tone={r.result === 'Answered' ? 'success' : 'warning'}>{r.result}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  )
}
