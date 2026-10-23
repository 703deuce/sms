import { PowerDialerCallbacksContent } from '@/components/power-dialer/callbacks-content'

export const metadata = { title: 'Callbacks · Power Dialer' }

export default async function PowerDialerCallbacksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  return <PowerDialerCallbacksContent initialTab={tab || 'due_today'} />
}
