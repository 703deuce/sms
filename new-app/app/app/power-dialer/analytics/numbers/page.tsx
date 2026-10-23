import { redirect } from 'next/navigation'

export default function AnalyticsNumbersRedirect() {
  redirect('/app/power-dialer/analytics?tab=numbers')
}
