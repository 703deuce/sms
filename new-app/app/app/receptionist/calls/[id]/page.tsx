import { notFound } from 'next/navigation'
import { CallDetail } from '@/components/calls/call-detail'
import { getReceptionistCall } from '@/lib/server/receptionist/calls-service'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = await resolveWorkspaceId()
  const call = await getReceptionistCall(workspaceId, id)
  if (!call) notFound()
  return <CallDetail call={call} from={{ label: 'AI Receptionist · Calls', href: '/app/receptionist/calls' }} />
}
