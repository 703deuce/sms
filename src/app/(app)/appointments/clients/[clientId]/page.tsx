import { ClientDetailConnected } from '@/components/appointments/clients/client-detail-connected'
import { SchedulingPageGate } from '@/lib/appointments/scheduling-page-gate'
import { ClientDetailOpus } from '@/newui-transplant/connected/scheduling/client-detail-opus'

type Props = { params: Promise<{ clientId: string }> }

export default async function AppointmentsClientDetailPage({ params }: Props) {
  const { clientId } = await params
  return (
    <SchedulingPageGate
      opus={<ClientDetailOpus clientId={clientId} />}
      legacy={<ClientDetailConnected clientId={clientId} />}
    />
  )
}
