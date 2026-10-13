import { BookingShareGate } from '@/newui-transplant/connected/scheduling/scheduling-unified-gates'
import { getPrisma } from '@/lib/db'
import { requireWorkspaceContext } from '@/lib/workspace-data'
import { listAppointmentTypes } from '@/lib/appointments/booking-platform'

export default async function BookingShareHubPage() {
  const { workspaceId } = await requireWorkspaceContext()
  const ws = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, name: true, displayName: true },
  })
  const types = await listAppointmentTypes(workspaceId)

  return (
    <BookingShareGate
      workspaceSlug={ws?.slug || ''}
      workspaceName={ws?.displayName || ws?.name || 'Your business'}
      types={types.map((t: { id: string; name: string }) => ({
        id: t.id,
        name: t.name,
      }))}
    />
  )
}
