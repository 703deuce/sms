import { VoiceAgentBuilder } from "@/components/voice/voice-agent-builder";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";

export default async function VoiceAgentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <PageHeader title="Agent builder" description="Configure identity, instructions, voice, model, and publishing." />
      <VoiceSubNav />
      <VoiceAgentBuilder agentId={id} />
    </div>
  );
}
