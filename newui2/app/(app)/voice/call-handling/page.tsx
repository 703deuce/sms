import type { Metadata } from 'next'
import { ArrowDown, Bot, GripVertical, Plus, User } from 'lucide-react'
import { PageHeader, Panel, SettingRow, StatusPill } from '@/components/app/primitives'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { SimpleSelect } from '@/components/app/simple-select'
import { td, th } from '@/components/app/tables'

export const metadata: Metadata = { title: 'Call Handling' }

const targets = [
  { name: 'Front desk', number: '(512) 555-0199', ring: '20s' },
  { name: 'Jamie Reyes (Owner)', number: '(512) 555-0177', ring: '15s' },
  { name: 'On-call technician', number: '(512) 555-0153', ring: '20s' },
]

const transfers = [
  { caller: 'Dana Whitfield', to: 'On-call technician', reason: 'Emergency — active leak', result: 'Answered', time: 'Today 8:55 AM' },
  { caller: 'Ethan Park', to: 'Front desk', reason: 'Billing question', result: 'Answered', time: 'Sep 23 9:20 AM' },
  { caller: 'Grace Kim', to: 'Front desk', reason: 'Asked for a person', result: 'No answer → voicemail', time: 'Sep 22 5:47 PM' },
]

export default function CallHandlingPage() {
  return (
    <>
      <PageHeader
        title="Call Handling"
        description="Decide who answers, when calls transfer, and how emergencies are routed."
        actions={<Button className="h-9">Save changes</Button>}
      />

      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Bot className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Right now</span>
            <span className="text-sm font-semibold">Amy answers every call</span>
          </div>
        </div>
        <ArrowDown className="size-4 text-muted-foreground md:-rotate-90" aria-hidden="true" />
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <User className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Transfers to your team</span>
            <span className="text-sm font-semibold">When caller asks or it’s urgent</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Transfers" description="Tried top to bottom until someone answers." action={<Button variant="outline" size="sm"><Plus aria-hidden="true" /> Add</Button>} bodyClassName="p-0">
          <ol className="divide-y">
            {targets.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3 px-5 py-3.5">
                <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{t.number}</span>
                </div>
                <span className="text-xs text-muted-foreground">Ring {t.ring}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Business hours & after hours" bodyClassName="divide-y">
          <SettingRow title="During business hours" description="Mon–Sat, 7a–7p" control={<SimpleSelect label="During hours" className="w-40" options={[{ value: 'ai', label: 'AI answers' }, { value: 'team', label: 'Ring team first' }]} />} />
          <SettingRow title="After hours" description="Nights, Sundays, holidays" control={<SimpleSelect label="After hours" className="w-40" options={[{ value: 'ai', label: 'AI answers' }, { value: 'vm', label: 'Voicemail' }]} />} />
          <SettingRow title="On-call rotation" description="Route urgent after-hours calls to on-call tech" control={<Switch defaultChecked aria-label="On-call rotation" />} />
        </Panel>

        <Panel title="Emergency & urgent calls" bodyClassName="divide-y">
          <SettingRow title="Detect emergencies" description="Active leaks, gas smell, no heat under 40°F" control={<Switch defaultChecked aria-label="Detect emergencies" />} />
          <SettingRow title="Transfer immediately" description="Skip intake questions for emergencies" control={<Switch defaultChecked aria-label="Transfer immediately" />} />
          <SettingRow title="Text the owner" description="Send an SMS for every emergency call" control={<Switch aria-label="Text the owner" />} />
        </Panel>

        <Panel title="Notifications, protection & recording" bodyClassName="divide-y">
          <SettingRow title="Transfer notifications" description="Whisper caller summary before connecting" control={<Switch defaultChecked aria-label="Transfer notifications" />} />
          <SettingRow title="Caller protection" description="Screen spam and solicitors automatically" control={<Switch defaultChecked aria-label="Caller protection" />} />
          <SettingRow title="Call recording" description="Record and transcribe calls with disclosure" control={<Switch defaultChecked aria-label="Call recording" />} />
        </Panel>
      </div>

      <Panel title="Recent transfers" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className={th}>Caller</th>
                <th className={th}>Transferred to</th>
                <th className={th}>Reason</th>
                <th className={th}>Result</th>
                <th className={th}>Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transfers.map((t) => (
                <tr key={t.caller + t.time}>
                  <td className={`${td} font-medium`}>{t.caller}</td>
                  <td className={td}>{t.to}</td>
                  <td className={`${td} text-muted-foreground`}>{t.reason}</td>
                  <td className={td}>
                    <StatusPill tone={t.result === 'Answered' ? 'success' : 'warning'}>{t.result}</StatusPill>
                  </td>
                  <td className={`${td} text-muted-foreground`}>{t.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
