'use client'

import { MoreHorizontal, Plus } from 'lucide-react'
import { FieldRow, Initials, Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { formatPhone } from '@/lib/utils'

export type MctbSetupNotificationsUrgentWired = {
  enabled: boolean
  instructions: string
  urgentBusinessSmsEntitled: boolean
  testMessage: string
  testBusy: boolean
  testResultLabel: string | null
  onEnabledChange: (v: boolean) => void
  onInstructionsChange: (v: string) => void
  onInstructionsBlur: () => void
  onTestMessageChange: (v: string) => void
  onRunTest: () => void
}

export type MctbSetupNotificationsWired = {
  recipients: Array<{ name: string; email: string; mobile: string }>
  events: Array<{ label: string; email: boolean; sms: boolean; smsDisabled?: boolean; onEmailChange?: (v: boolean) => void; onSmsChange?: (v: boolean) => void }>
  onAddRecipient?: () => void
  urgent?: MctbSetupNotificationsUrgentWired
}

const DEMO_RECIPIENTS = [
  { name: 'Dana Whitaker', email: 'dana@northsideplumbing.com', mobile: '(512) 555-0161' },
  { name: 'Jake Morales', email: 'jake@northsideplumbing.com', mobile: '(512) 555-0170' },
  { name: 'Front office', email: 'office@northsideplumbing.com', mobile: '—' },
]

const DEMO_EVENTS = [
  { label: 'Customer replied', email: true, sms: true },
  { label: 'Needs reply (15 min)', email: true, sms: true },
  { label: 'New voicemail', email: true, sms: false },
  { label: 'Delivery failure', email: true, sms: false },
  { label: 'Forwarding stopped working', email: true, sms: true },
]

export function TransplantMctbSetupNotificationsPage({ wired }: { wired?: MctbSetupNotificationsWired }) {
  const live = wired !== undefined
  const recipients = live ? (wired?.recipients ?? []) : DEMO_RECIPIENTS
  const events = live ? (wired?.events ?? []) : DEMO_EVENTS
  const urgent = wired?.urgent

  return (
    <div className="flex flex-col gap-4">
      {urgent ? (
        <Panel
          title="Urgent Reply Alerts"
          description="Classify inbound replies from your instructions. Works when AI Recovery is off. Does not text customers."
        >
          <div className="divide-y px-5">
            <FieldRow
              label="Urgent Reply Alerts"
              description="Run semantic urgency on each inbound MCTB reply before team notifications."
            >
              <Checkbox
                checked={urgent.enabled}
                onCheckedChange={(v) => urgent.onEnabledChange(Boolean(v))}
                aria-label="Urgent Reply Alerts enabled"
              />
            </FieldRow>
            <div className="py-4">
              <label className="text-sm font-medium" htmlFor="mctb-urgent-instructions">
                What should Transovo consider urgent?
              </label>
              <Textarea
                id="mctb-urgent-instructions"
                className="mt-2"
                rows={4}
                value={urgent.instructions}
                onChange={(e) => urgent.onInstructionsChange(e.target.value)}
                onBlur={urgent.onInstructionsBlur}
                placeholder="Example: Active flooding, gas smell, no heat in winter…"
              />
            </div>
            {!urgent.urgentBusinessSmsEntitled ? (
              <p className="pb-4 text-xs text-muted-foreground">
                Urgent business SMS alerts require an active MCTB paid plan. Email urgent alerts still apply per Events below.
              </p>
            ) : null}
            <div className="py-4">
              <FieldRow label="Test Urgent Rules" description="Uses the production classifier. Does not message customers or send alerts.">
                <span />
              </FieldRow>
              <Textarea
                id="mctb-urgent-test-message"
                className="mt-2"
                rows={2}
                value={urgent.testMessage}
                onChange={(e) => urgent.onTestMessageChange(e.target.value)}
                aria-label="Sample customer reply for urgent test"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={urgent.testBusy || !urgent.testMessage.trim()}
                  onClick={urgent.onRunTest}
                >
                  {urgent.testBusy ? 'Testing…' : 'Run test'}
                </Button>
                {urgent.testResultLabel ? (
                  <Pill tone={urgent.testResultLabel.startsWith('Urgent') ? 'warning' : 'neutral'}>
                    {urgent.testResultLabel}
                  </Pill>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}
      <Panel
        title="Team recipients"
        action={
          <Button size="sm" variant="outline" type="button" onClick={() => wired?.onAddRecipient?.()}>
            <Plus /> Add recipient
          </Button>
        }
        bodyClassName="p-0"
      >
        <ul className="divide-y">
          {recipients.map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-5 py-3">
              <Initials name={r.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.email} · {r.mobile}</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.name}`}><MoreHorizontal /></Button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Events" description="Choose how the team is notified" bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-5 py-2.5 font-medium">Event</th>
              <th scope="col" className="w-20 px-3 py-2.5 text-center font-medium">Email</th>
              <th scope="col" className="w-20 px-5 py-2.5 text-center font-medium">SMS</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.map((e) => (
              <tr key={e.label}>
                <td className="px-5 py-3">{e.label}</td>
                <td className="px-3 py-3 text-center">
                  <Checkbox
                    checked={e.email}
                    onCheckedChange={(v) => e.onEmailChange?.(Boolean(v))}
                    aria-label={`${e.label} by email`}
                  />
                </td>
                <td className="px-5 py-3 text-center">
                  <Checkbox
                    checked={e.sms}
                    disabled={e.smsDisabled}
                    onCheckedChange={(v) => e.onSmsChange?.(Boolean(v))}
                    aria-label={`${e.label} by SMS`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

export function formatRecipientMobile(mobileE164?: string | null): string {
  if (!mobileE164?.trim()) return '—'
  return formatPhone(mobileE164)
}
