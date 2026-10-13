import { BookingSettingsGate } from '@/newui-transplant/connected/scheduling/scheduling-unified-gates'
import { getPrisma } from '@/lib/db'
import { requireWorkspaceContext } from '@/lib/workspace-data'

export default async function AppointmentBookingPage() {
  const { workspaceId } = await requireWorkspaceContext()
  const ws = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true, name: true, displayName: true },
  })

  return (
    <BookingSettingsGate
      workspaceSlug={ws?.slug || ''}
      workspaceName={ws?.displayName || ws?.name || 'Your business'}
    />
  )
}
