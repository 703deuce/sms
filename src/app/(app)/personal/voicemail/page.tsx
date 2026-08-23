import { PersonalVoicemailUI } from "@/components/personal/personal-voicemail-ui";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { redirect } from "next/navigation";

export default async function PersonalVoicemailPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const entitled = await hasWorkspaceProductFeature(workspaceId, "visual_voicemail");
  if (!entitled) {
    redirect("/settings/billing?upgrade=visual_voicemail");
  }
  const numbers = await loadPersonalNumbers(workspaceId);
  const { numberId } = await searchParams;

  return <PersonalVoicemailUI numberId={numberId} numbers={numbers} />;
}
