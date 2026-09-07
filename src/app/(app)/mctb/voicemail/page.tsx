import { MctbVoicemailView } from "@/components/mctb/mctb-voicemail-view";
import { AddOnUpgradeCard } from "@/components/products/add-on-upgrade-card";
import { hasMctbBundledVoicemailAccess } from "@/lib/products/feature-entitlements";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function MctbVoicemailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const entitled = await hasMctbBundledVoicemailAccess(workspaceId, {
    isPlatformAdmin: session.isAdmin,
  });

  if (!entitled) {
    return <AddOnUpgradeCard feature="visual_voicemail" />;
  }

  const { id } = await searchParams;
  return <MctbVoicemailView initialId={id} />;
}
