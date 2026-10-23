import { redirect } from 'next/navigation'

export default function AnalyticsCampaignsRedirect() {
  redirect('/app/power-dialer/analytics?tab=campaigns')
}
