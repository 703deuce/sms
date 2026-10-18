import { notFound } from 'next/navigation'
import { CallDetail } from '@/components/calls/call-detail'
import { getCall } from '@/lib/data'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const call = getCall(id)
  if (!call) notFound()
  return <CallDetail call={call} from={{ label: 'Missed Call Text Back · Missed Calls', href: '/app/mctb/calls' }} />
}
