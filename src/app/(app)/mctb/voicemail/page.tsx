import { AddOnUpgradeCard } from "@/components/products/add-on-upgrade-card";
import { MctbVoicemailWorkspace } from "@/components/mctb/voicemail/mctb-voicemail-workspace";
import { hasMctbBundledVoicemailAccess } from "@/lib/products/feature-entitlements";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { Suspense } from "react";

export default async function MctbVoicemailPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string; id?: string }>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const entitled = await hasMctbBundledVoicemailAccess(workspaceId, {
    isPlatformAdmin: session.isAdmin,
  });
  if (!entitled) {
    return <AddOnUpgradeCard feature="visual_voicemail" />;
  }
  const numbers = await loadPersonalNumbers(workspaceId);
  const { numberId, id } = await searchParams;

  return (
    <Suspense fallback={null}>
      <MctbVoicemailWorkspace
        numbers={numbers}
        initialNumberId={numberId}
        initialMessageId={id}
      />
    </Suspense>
  );
}
