import { redirect } from 'next/navigation'

export default function AnalyticsRepresentativesRedirect() {
  redirect('/app/power-dialer/analytics?tab=representatives')
}
