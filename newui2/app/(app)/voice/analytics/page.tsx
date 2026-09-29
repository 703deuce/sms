import type { Metadata } from 'next'
import { PageHeader } from '@/components/app/primitives'
import { VoiceAnalytics } from '@/components/voice/voice-analytics'

export const metadata: Metadata = { title: 'Receptionist Analytics' }

export default function VoiceAnalyticsPage() {
  return (
    <>
      <PageHeader title="Analytics" description="Performance of your AI receptionist over time." />
      <VoiceAnalytics />
    </>
  )
}
