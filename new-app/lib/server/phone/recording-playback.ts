import { getPrisma } from "@/lib/server/db";
import {
  humanCallHasRecordingArtifact,
  resolveHumanCallRecordingDownloadUrl,
  type HumanCallRecordingFields,
} from "@/lib/server/phone/resolve-recording-url";

const recordingSelect = {
  id: true,
  workspaceId: true,
  recordingUrl: true,
  telnyxCallControlId: true,
  telnyxCallLegId: true,
  recordingStartedAt: true,
  metadata: true,
} as const;

export async function loadHumanCallForRecordingPlayback(workspaceId: string, humanCallId: string) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: humanCallId, workspaceId },
    select: recordingSelect,
  });
  if (!call || !humanCallHasRecordingArtifact(call)) return null;
  return call;
}

/** Resolve a fresh Telnyx URL and persist when the stored presign expired. */
export async function resolveHumanCallRecordingForPlayback(
  call: HumanCallRecordingFields & { id: string; workspaceId: string },
): Promise<string | null> {
  const downloadUrl = await resolveHumanCallRecordingDownloadUrl(call);
  if (!downloadUrl) return null;

  if (downloadUrl !== call.recordingUrl) {
    const prisma = getPrisma();
    await prisma.humanCall.update({
      where: { id: call.id },
      data: { recordingUrl: downloadUrl },
    });
  }

  return downloadUrl;
}
