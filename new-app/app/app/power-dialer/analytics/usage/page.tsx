import { redirect } from 'next/navigation'

export default function AnalyticsUsageRedirect() {
  redirect('/app/power-dialer/analytics?tab=usage')
}
