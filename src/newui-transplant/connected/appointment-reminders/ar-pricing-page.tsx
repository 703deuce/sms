'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AR_PLAN_CATALOG,
  type ArPlanKey,
} from '@/lib/appointment-reminders/commercial/ar-plan-catalog'
import {
  appointmentRemindersProductOpenPath,
  appointmentRemindersSignupPath,
} from '@/lib/appointment-reminders/commercial/product-open'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { Page, PageHeader, Panel } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { formatCurrency } from '@/lib/utils'

const ORDER: ArPlanKey[] = ['free', 'starter', 'growth', 'business']

export function AppointmentRemindersPricingPage() {
  const [busy, setBusy] = useState<ArPlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function selectPlan(plan: ArPlanKey) {
    setBusy(plan)
    setError(null)
    try {
      window.location.href = appointmentRemindersProductOpenPath({
        plan,
        next: AR_ROUTES.setupConnect,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Page className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Appointment Reminders"
        description="Automated SMS and email reminders with Microsoft calendar sync. Pick a monthly plan — no overage charges."
      />
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {ORDER.map((key) => {
          const plan = AR_PLAN_CATALOG[key]
          return (
            <Panel key={key} title={plan.displayName} description={plan.monthlyPriceCents === 0 ? '$0 / month' : `${formatCurrency(plan.monthlyPriceCents / 100)} / month`}>
              <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>{plan.smsSegmentsPerMonth} SMS segments / month</li>
                <li>{plan.emailsPerMonth} emails / month</li>
                <li>{plan.importedCalendarsMax} import calendar(s)</li>
                <li>{plan.reminderStepsMax} reminder step(s)</li>
                {plan.aiConversationsPerMonth > 0 ? (
                  <li>{plan.aiConversationsPerMonth} AI rescheduling conversations / month</li>
                ) : null}
              </ul>
              <Button type="button" className="w-full" disabled={busy !== null} onClick={() => selectPlan(key)}>
                {busy === key ? 'Please wait…' : key === 'free' ? 'Start free' : 'Subscribe'}
              </Button>
            </Panel>
          )
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href={`/login?next=${encodeURIComponent(AR_ROUTES.pricing)}`} className="text-primary underline">
          Sign in
        </Link>
      </p>
    </Page>
  )
}
