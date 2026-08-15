import { PersonalVoicemailUI } from "@/components/personal/personal-voicemail-ui";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalVoicemailPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  await requireWorkspaceContext();
  const { numberId } = await searchParams;

  return <PersonalVoicemailUI numberId={numberId} />;
}
