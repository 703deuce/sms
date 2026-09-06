import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getPrisma } from "@/lib/db";
import { RoutingFormsClient } from "@/components/appointments/routing-forms-client";

export default async function RoutingFormsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const ws = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  });
  return <RoutingFormsClient workspaceSlug={ws?.slug || ""} />;
}
