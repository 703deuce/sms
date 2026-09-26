import { AddOnUpgradeCard } from "@/components/products/add-on-upgrade-card";
import { MctbVoicemailWorkspace } from "@/components/mctb/voicemail/mctb-voicemail-workspace";
import { hasMctbBundledVoicemailAccess } from "@/lib/products/feature-entitlements";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { TransplantMctbVoicemailPage } from "@/newui-transplant/mirror/routes/mctb/voicemail/page";
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
  const { numberId, id } = await searchParams;

  if (isNewUiStage2Enabled()) {
    return <TransplantMctbVoicemailPage />;
  }

  const numbers = await loadPersonalNumbers(workspaceId);

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
