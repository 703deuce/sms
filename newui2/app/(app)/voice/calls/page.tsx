import type { Metadata } from 'next'
import { PageHeader } from '@/components/app/primitives'
import { CallsView } from '@/components/voice/calls-view'

export const metadata: Metadata = { title: 'Calls' }

export default function CallsPage() {
  return (
    <>
      <PageHeader title="Calls" description="Track and manage calls handled by the AI receptionist." />
      <CallsView />
    </>
  )
}
