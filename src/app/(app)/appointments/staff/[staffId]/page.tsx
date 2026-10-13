import { StaffDetailConnected } from '@/components/appointments/staff/staff-detail-connected'
import { SchedulingPageGate } from '@/lib/appointments/scheduling-page-gate'
import { StaffDetailOpus } from '@/newui-transplant/connected/scheduling/staff-detail-opus'

type Props = { params: Promise<{ staffId: string }> }

export default async function StaffDetailPage({ params }: Props) {
  const { staffId } = await params
  return (
    <SchedulingPageGate
      opus={<StaffDetailOpus staffId={staffId} />}
      legacy={<StaffDetailConnected staffId={staffId} />}
    />
  )
}
