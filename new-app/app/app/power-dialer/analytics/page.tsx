import { Suspense } from 'react'
import { PowerDialerAnalyticsTabShell } from '@/components/power-dialer/analytics-tab-shell'

export const metadata = { title: 'Analytics · Power Dialer' }

export default async function PowerDialerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <PowerDialerAnalyticsTabShell initialTab={tab || 'overview'} />
    </Suspense>
  )
}
