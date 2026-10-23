import { notFound } from 'next/navigation'
import { CallDetail } from '@/components/calls/call-detail'
import { mapPhoneCallDtoToCall } from '@/lib/phone-ui-map'
import { getCallDetail } from '@/lib/server/phone/calls-service'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const dynamic = 'force-dynamic'

export default async function PowerDialerCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = await resolveWorkspaceId()
  const dto = await getCallDetail(workspaceId, id)
  if (!dto) notFound()
  const call = mapPhoneCallDtoToCall(dto)
  return (
    <CallDetail call={call} from={{ label: 'Power Dialer · Call history', href: '/app/power-dialer/call-history' }} />
  )
}
