'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AR_PLAN_CATALOG, type ArPlanKey } from '@/lib/appointment-reminders/commercial/ar-plan-catalog'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { Panel, Pill, Stat } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { formatCurrency } from '@/lib/utils'

type BillingSnapshot = {
  plan: { key: ArPlanKey; displayName: string; monthlyPriceCents: number }
  subscription: {
    status: string | null
    cancelAtPeriodEnd: boolean
    paidThrough: string | null
    isLegacyGrandfather: boolean
  }
  usagePeriod: { periodStart: string; periodEnd: string }
  usage: {
    smsSegments: { used: number; limit: number; remaining: number; state: string }
    emails: { used: number; limit: number; remaining: number; state: string }
    aiConversations: { used: number; limit: number; remaining: number; state: string }
    importedCalendars: { used: number; limit: number }
  }
}

function usageLabel(state: string): string {
  if (state === 'exhausted') return 'Allowance used'
  if (state === 'approaching') return 'Approaching limit'
  return 'Within allowance'
}

export function ArBillingSettingsOpus() {
  const [data, setData] = useState<BillingSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    return fetch('/api/appointment-reminders/billing', { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) throw new Error(json.error || 'Failed to load billing')
        setData(json.data as BillingSnapshot)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load billing'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function openPortal() {
    setBusy('portal')
    try {
      const res = await fetch('/api/appointment-reminders/billing/portal', { method: 'POST' })
      const json = await res.json()
      if (json.data?.url) window.location.href = json.data.url
      else setError(json.error || 'Billing portal unavailable')
    } finally {
      setBusy(null)
    }
  }

  async function changePlan(plan: ArPlanKey) {
    if (plan === 'free') return
    setBusy(plan)
    setError(null)
    try {
      const res = await fetch('/api/appointment-reminders/billing/change-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json()
      if (json.data?.checkout?.url) {
        window.location.href = json.data.checkout.url
        return
      }
      if (!res.ok) throw new Error(json.error || 'Plan change failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan change failed')
    } finally {
      setBusy(null)
    }
  }

  async function cancelAtPeriodEnd() {
    setBusy('cancel')
    try {
      const res = await fetch('/api/appointment-reminders/billing/manage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_at_period_end' }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Cancel failed')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading billing…</p>
  if (error && !data) return <p className="text-sm text-destructive">{error}</p>
  if (!data) return null

  const periodEnd = data.subscription.paidThrough
    ? new Date(data.subscription.paidThrough).toLocaleDateString()
    : new Date(data.usagePeriod.periodEnd).toLocaleDateString()

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Panel title="Current plan" description="Subscription and included monthly allowances.">
        <div className="flex flex-wrap items-center gap-3">
          <Pill>{data.plan.displayName}</Pill>
          <span className="text-sm text-muted-foreground">
            {data.plan.monthlyPriceCents === 0
              ? '$0 / month'
              : `${formatCurrency(data.plan.monthlyPriceCents / 100)} / month`}
          </span>
          {data.subscription.isLegacyGrandfather ? (
            <Pill tone="neutral">Legacy access</Pill>
          ) : null}
          {data.subscription.cancelAtPeriodEnd ? (
            <Pill tone="warning">Cancels {periodEnd}</Pill>
          ) : (
            <span className="text-sm text-muted-foreground">Renews / resets {periodEnd}</span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => openPortal()}>
            Payment method & invoices
          </Button>
          {!data.subscription.cancelAtPeriodEnd && data.plan.key !== 'free' ? (
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => cancelAtPeriodEnd()}>
              Cancel at period end
            </Button>
          ) : null}
          <Button type="button" variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.pricing} />}>
            View all plans
          </Button>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="SMS segments"
          value={`${data.usage.smsSegments.used} / ${data.usage.smsSegments.limit}`}
          hint={usageLabel(data.usage.smsSegments.state)}
        />
        <Stat
          label="Emails"
          value={`${data.usage.emails.used} / ${data.usage.emails.limit}`}
          hint={usageLabel(data.usage.emails.state)}
        />
        <Stat
          label="AI conversations"
          value={
            data.usage.aiConversations.limit > 0
              ? `${data.usage.aiConversations.used} / ${data.usage.aiConversations.limit}`
              : 'Not included'
          }
          hint={usageLabel(data.usage.aiConversations.state)}
        />
        <Stat
          label="Import calendars"
          value={`${data.usage.importedCalendars.used} / ${data.usage.importedCalendars.limit}`}
        />
      </div>

      <Panel title="Change plan" description="Upgrades apply immediately with proration. Downgrades follow Stripe renewal rules.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(AR_PLAN_CATALOG) as ArPlanKey[]).map((key) => {
            const plan = AR_PLAN_CATALOG[key]
            const current = key === data.plan.key
            return (
              <div key={key} className="rounded-lg border p-4">
                <p className="font-medium">{plan.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  {plan.monthlyPriceCents === 0 ? 'Free' : formatCurrency(plan.monthlyPriceCents / 100)}/mo
                </p>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  variant={current ? 'secondary' : 'default'}
                  disabled={current || busy !== null || key === 'free'}
                  onClick={() => changePlan(key)}
                >
                  {current ? 'Current' : key === 'free' ? 'Free tier' : 'Select'}
                </Button>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
