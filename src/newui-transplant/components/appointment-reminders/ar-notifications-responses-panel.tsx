'use client'

import Link from 'next/link'
import { Panel, Callout } from '@/newui-transplant/components/app/kit'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Input } from '@/newui-transplant/components/ui/input'
import { Button } from '@/newui-transplant/components/ui/button'
import type { ReminderPreferences } from '@/lib/appointments/types'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'

type Props = {
  prefs: ReminderPreferences
  onPrefsChange: (patch: Partial<ReminderPreferences>) => void
  readiness: { sms: string; email: string }
  testPhone: string
  testEmail: string
  testStep: string
  stepOptions: Array<{ value: string; label: string }>
  onTestPhoneChange: (v: string) => void
  onTestEmailChange: (v: string) => void
  onTestStepChange: (v: string) => void
  onSendTest: () => void
  testing: boolean
  testError: string
}

export function ArNotificationsResponsesPanel({
  prefs,
  onPrefsChange,
  readiness,
  testPhone,
  testEmail,
  testStep,
  stepOptions,
  onTestPhoneChange,
  onTestEmailChange,
  onTestStepChange,
  onSendTest,
  testing,
  testError,
}: Props) {
  return (
    <div className="space-y-4">
      <Panel title="Default channel preferences" description="Recipient-level preferences on an appointment override this default when eligible.">
        <SimpleSelect
          label="Workspace default"
          value={prefs.defaultNotificationChannel || 'both'}
          onChange={(v) => onPrefsChange({ defaultNotificationChannel: v as 'sms' | 'email' | 'both' })}
          options={[
            { value: 'both', label: 'SMS and email (per step)' },
            { value: 'sms', label: 'SMS only' },
            { value: 'email', label: 'Email only' },
          ]}
        />
      </Panel>

      <Panel title="Confirmation behavior">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.skipConfirmationStepsWhenConfirmed === true}
            onChange={(e) => onPrefsChange({ skipConfirmationStepsWhenConfirmed: e.target.checked })}
          />
          Skip confirmation request steps after the appointment is confirmed
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Individual reminder steps can also skip when confirmed. Customer SMS replies (C / R / X) are handled by the AI rescheduler and inbox — configure in{' '}
          <Link href={AR_ROUTES.aiRescheduler} className="font-medium underline">AI Rescheduler</Link>.
        </p>
      </Panel>

      <Panel title="Customer response actions" description="Supported on SMS and email action links when templates include the links.">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Confirm appointment — SMS reply or email button when enabled in templates</li>
          <li>Request cancellation — customer-initiated; honored per workspace policy</li>
          <li>Request rescheduling — SMS AI flow or reschedule link in email</li>
        </ul>
      </Panel>

      <Panel title="Sender readiness">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">SMS sender</dt>
            <dd className="font-medium">{readiness.sms}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email sender</dt>
            <dd className="font-medium">{readiness.email}</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/compliance" />}>
            Compliance &amp; sender setup
          </Button>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/contacts" />}>
            Contacts &amp; preferences
          </Button>
        </div>
      </Panel>

      <Panel title="Send test reminder" description="Uses current saved templates and merge preview data.">
        <div className="grid gap-3 sm:grid-cols-2">
          <SimpleSelect label="Step" value={testStep} onChange={onTestStepChange} options={stepOptions} />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Test phone</span>
            <Input value={testPhone} onChange={(e) => onTestPhoneChange(e.target.value)} autoComplete="tel" className="h-10" />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium">Test email</span>
            <Input value={testEmail} onChange={(e) => onTestEmailChange(e.target.value)} autoComplete="email" className="h-10" />
          </label>
        </div>
        {testError ? <p className="mt-2 text-xs text-destructive" role="alert">{testError}</p> : null}
        <Button type="button" className="mt-3" onClick={onSendTest} disabled={testing}>
          {testing ? 'Sending…' : 'Send test'}
        </Button>
      </Panel>
    </div>
  )
}
