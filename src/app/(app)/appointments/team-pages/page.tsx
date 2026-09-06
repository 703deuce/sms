import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getPrisma } from "@/lib/db";
import { TeamPagesClient } from "@/components/appointments/team-pages-client";

export default async function TeamPagesAdminPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const ws = await getPrisma().workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  });
  return <TeamPagesClient workspaceSlug={ws?.slug || ""} />;
}
