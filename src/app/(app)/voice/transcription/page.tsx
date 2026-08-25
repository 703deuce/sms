import Link from "next/link";
import { AddOnUpgradeCard } from "@/components/products/add-on-upgrade-card";
import { PersonalVoicemailUI } from "@/components/personal/personal-voicemail-ui";
import { loadPersonalNumbers } from "@/lib/workspace/personal-data";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

export default async function VoiceTranscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ numberId?: string }>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const entitled = await hasWorkspaceProductFeature(workspaceId, "ai_transcription", {
    isPlatformAdmin: session.isAdmin,
  });

  if (!entitled) {
    return (
      <AddOnUpgradeCard
        feature="ai_transcription"
        title="Transcription"
        description="Turn voicemails into readable text and get a quick AI summary of what the caller needs."
      />
    );
  }

  const numbers = await loadPersonalNumbers(workspaceId);
  const { numberId } = await searchParams;

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Transcription</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Playback, full transcript, and AI summary for voicemails from your missed-call recovery
          flow.{" "}
          <Link href="/voice/voicemail" className="text-primary hover:underline">
            Open Visual Voicemail inbox
          </Link>
        </p>
      </div>
      <PersonalVoicemailUI numberId={numberId} numbers={numbers} />
    </div>
  );
}
