import { redirect } from 'next/navigation'

export default function AnalyticsScreeningRedirect() {
  redirect('/app/power-dialer/analytics?tab=screening')
}
