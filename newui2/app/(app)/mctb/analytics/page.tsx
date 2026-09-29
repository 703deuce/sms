import type { Metadata } from 'next'
import { MctbAnalytics } from '@/components/mctb/mctb-analytics'

export const metadata: Metadata = { title: 'Missed Call Analytics' }

export default function MctbAnalyticsPage() {
  return <MctbAnalytics />
}
