import { Suspense } from 'react'
import { PowerDialerCallbacksContent } from '@/components/power-dialer/callbacks-content'

export const metadata = { title: 'Callbacks · Power Dialer' }

export default async function PowerDialerCallbacksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <PowerDialerCallbacksContent initialTab={tab || 'due_today'} />
    </Suspense>
  )
}
