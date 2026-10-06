'use client'

import { Bell, Bolt, FlaskConical, MoreHorizontal, Plus, Users } from 'lucide-react'
import { ConfigSection, Initials, Panel, Pill, TextLink } from '@/newui-transplant/components/app/kit'
import { td, th } from '@/newui-transplant/components/app/opus-tables'
import { OPUS_CONFIG_INSET, OPUS_INSET_LIST, OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'
import { Button } from '@/newui-transplant/components/ui/button'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { formatPhone } from '@/lib/utils'

export type MctbSetupNotificationsUrgentWired = {
  enabled: boolean
  /** Read-only preview of criteria stored in AI Recovery / business knowledge */
  criteriaPreview: string | null
  criteriaEditHref?: string | null
  urgentBusinessSmsEntitled: boolean
  testMessage: string
  testBusy: boolean
  testResultLabel: string | null
  onEnabledChange: (v: boolean) => void
  onTestMessageChange: (v: string) => void
  onRunTest: () => void
}

export type MctbSetupNotificationsWired = {
  recipients: Array<{ id: string; name: string; email: string; mobile: string }>
  events: Array<{
    label: string
    email: boolean
    sms: boolean
    smsDisabled?: boolean
    smsDisabledReason?:
      | 'launch_email_only'
      | 'urgent_sms_requires_plan'
      | 'business_reply_sms_requires_plan'
    onEmailChange?: (v: boolean) => void
    onSmsChange?: (v: boolean) => void
  }>
  onAddRecipient?: () => void
  onEditRecipient?: (id: string) => void
  urgent?: MctbSetupNotificationsUrgentWired
}

export function TransplantMctbSetupNotificationsPage({ wired }: { wired?: MctbSetupNotificationsWired }) {
  const recipients = wired?.recipients ?? []
  const events = wired?.events ?? []
  const urgent = wired?.urgent

  return (
    <div className="flex flex-col gap-8">
      {urgent ? (
        <ConfigSection
          icon={Bolt}
          title="Urgent Reply Alerts"
          description="Notify your team when an inbound reply looks urgent. Turn alerts on or off here."
        >
          <div className="flex flex-col gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Enable urgency detection</p>
                  <p className="text-sm text-muted-foreground">
                    Run semantic urgency on each inbound MCTB reply before team notifications.
                  </p>
                </div>
                <Switch
                  checked={urgent.enabled}
                  onCheckedChange={(v) => urgent.onEnabledChange(Boolean(v))}
                  aria-label="Urgent Reply Alerts enabled"
                />
            </div>

            <div className={cn(OPUS_CONFIG_INSET, 'bg-background/60 p-4')}>
              <p className="text-sm font-medium">What counts as urgent</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Criteria are read-only on this page. Contact support to change urgency rules.
              </p>
              {urgent.criteriaPreview?.trim() ? (
                <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{urgent.criteriaPreview.trim()}</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No urgent criteria saved yet.</p>
              )}
              {urgent.criteriaEditHref ? (
                <p className="mt-3">
                  <TextLink href={urgent.criteriaEditHref}>Edit urgent criteria</TextLink>
                </p>
              ) : null}
            </div>

            {!urgent.urgentBusinessSmsEntitled ? (
              <p className="text-xs text-muted-foreground">
                Urgent business SMS alerts require an active MCTB paid plan. Email urgent alerts still apply per Events
                below.
              </p>
            ) : null}

            <div className={cn(OPUS_CONFIG_INSET, 'border-dashed bg-muted/20 p-4')}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <FlaskConical className="size-4 text-muted-foreground" aria-hidden="true" />
                Test Urgent Rules
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Uses the production classifier. Does not message customers or send alerts.
              </p>
              <Textarea
                id="mctb-urgent-test-message"
                className="mt-3 min-h-[2.75rem] max-h-32 resize-y bg-background"
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
        </ConfigSection>
      ) : null}

      <ConfigSection
        icon={Users}
        title="Team recipients"
        description="Who receives reply and alert notifications."
        insetClassName="p-0"
      >
        <Panel
          action={
            <Button size="sm" variant="outline" type="button" onClick={() => wired?.onAddRecipient?.()}>
              <Plus /> Add recipient
            </Button>
          }
          bodyClassName="p-0"
        >
          <ul className={OPUS_INSET_LIST}>
            {recipients.length === 0 ? (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                No team recipients yet. Add someone who should get reply alerts.
              </li>
            ) : null}
            {recipients.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30">
                <Initials name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.email} · {r.mobile}</p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  type="button"
                  aria-label={`Edit ${r.name}`}
                  onClick={() => wired?.onEditRecipient?.(r.id)}
                >
                  <MoreHorizontal />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      </ConfigSection>

      <ConfigSection
        icon={Bell}
        title="Reply notifications"
        description="Choose email and SMS for each event type."
        insetClassName="p-0"
      >
        <Panel bodyClassName="p-0">
          <table className="w-full">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={th}>Event</th>
                <th scope="col" className={cn(th, 'w-24 text-center')}>
                  <span className="text-primary">Email</span>
                </th>
                <th scope="col" className={cn(th, 'w-24 text-center')}>
                  <span className="text-muted-foreground">SMS</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((e) => (
                <tr key={e.label} className="transition-colors hover:bg-muted/35">
                  <td className={cn(td, 'font-medium')}>{e.label}</td>
                  <td className={cn(td, 'text-center')}>
                    <Checkbox
                      checked={e.email}
                      onCheckedChange={(v) => e.onEmailChange?.(Boolean(v))}
                      aria-label={`${e.label} by email`}
                    />
                  </td>
                  <td className={cn(td, 'text-center')}>
                    {e.smsDisabled ? (
                      <span
                        className="text-xs text-muted-foreground"
                        title={
                          e.smsDisabledReason === 'urgent_sms_requires_plan'
                            ? 'Urgent business SMS requires an AI Recovery plan.'
                            : e.smsDisabledReason === 'business_reply_sms_requires_plan'
                              ? 'Missed-call reply SMS alerts require a plan upgrade.'
                              : e.smsDisabledReason === 'launch_email_only'
                                ? 'SMS alerts for this event are not available at launch. Email notifications apply.'
                                : 'SMS not available for this event.'
                        }
                      >
                        —
                      </span>
                    ) : (
                      <Checkbox
                        checked={e.sms}
                        onCheckedChange={(v) => e.onSmsChange?.(Boolean(v))}
                        aria-label={`${e.label} by SMS`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </ConfigSection>
    </div>
  )
}

export function formatRecipientMobile(mobileE164?: string | null): string {
  if (!mobileE164?.trim()) return '—'
  return formatPhone(mobileE164)
}
