import { PersonalVoicemailClient } from "@/components/personal/personal-voicemail-client";
import { PageHeader } from "@/components/ui/page-header";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function PersonalVoicemailPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  await requireWorkspaceContext();
  const { numberId } = await searchParams;

  return (
    <div>
      <PageHeader title="Voicemail" description="Listen to messages and manage greetings." />
      <PersonalVoicemailClient numberId={numberId} />
    </div>
  );
}
