import { PersonalVoicemailUI } from "@/components/personal/personal-voicemail-ui";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalVoicemailPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const numbers = await loadPersonalNumbers(workspaceId);
  const { numberId } = await searchParams;

  return <PersonalVoicemailUI numberId={numberId} numbers={numbers} />;
}
