import { getPrisma } from "@/lib/server/db";
import { getPhoneSettings } from "@/lib/server/phone/settings";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";

export async function maybeStartCallRecordingOnAnswer(input: {
  workspaceId: string;
  humanCallId: string;
  telnyxCallControlId: string | null;
}) {
  if (!input.telnyxCallControlId) return;
  const settings = await getPhoneSettings(input.workspaceId);
  if (!settings.recordCalls) return;

  await telnyxCallAction(input.telnyxCallControlId, "record_start", {
    format: "mp3",
    channels: "dual",
    play_beep: false,
  });

  const prisma = getPrisma();
  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: { recordingStartedAt: new Date() },
  });
}
