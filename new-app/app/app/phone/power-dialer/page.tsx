import { redirect } from 'next/navigation'

export const metadata = { title: 'Power Dialer' }

export default async function LegacyPowerDialerRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  if (tab === 'lists') redirect('/app/power-dialer/calling-lists')
  if (tab === 'campaigns') redirect('/app/power-dialer/campaigns')
  redirect('/app/power-dialer/dialer')
}
