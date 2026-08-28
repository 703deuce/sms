import { AddOnUpgradeCard } from "@/components/products/add-on-upgrade-card";
import { PersonalVoicemailUI } from "@/components/personal/personal-voicemail-ui";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { hasMctbBundledVoicemailAccess } from "@/lib/products/feature-entitlements";

export default async function VoiceVoicemailPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const entitled = await hasMctbBundledVoicemailAccess(workspaceId, {
    isPlatformAdmin: session.isAdmin,
  });

  if (!entitled) {
    return <AddOnUpgradeCard feature="visual_voicemail" />;
  }

  const numbers = await loadPersonalNumbers(workspaceId);
  const { numberId } = await searchParams;

  return <PersonalVoicemailUI numberId={numberId} numbers={numbers} />;
}
