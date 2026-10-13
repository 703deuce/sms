import { RoutingFormsGate } from '@/newui-transplant/connected/scheduling/scheduling-unified-gates'
import { getPrisma } from '@/lib/db'
import { requireWorkspaceContext } from '@/lib/workspace-data'

export default async function RoutingFormsPage() {
  const { workspaceId } = await requireWorkspaceContext()
  const ws = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  })
  return <RoutingFormsGate workspaceSlug={ws?.slug || ''} />
}
