import "server-only";

import { getPrisma } from "@/lib/db";
import { speakOnCall } from "./telnyx-provider";

const DEFAULT_TEXT =
  "This call may be recorded for quality and training purposes.";

/** Play recording disclosure on the customer leg before bridging when enabled. */
export async function maybePlayRecordingAnnouncement(input: {
  workspaceId: string;
  customerCallControlId: string;
  sessionId?: string;
  direction?: "inbound" | "outbound";
}) {
  const prisma = getPrisma();
  const settings = await prisma.smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId: input.workspaceId },
    select: {
      recordingAnnouncementEnabled: true,
      recordingEnabledInbound: true,
      recordingEnabledOutbound: true,
    },
  });
  if (!settings?.recordingAnnouncementEnabled) return;

  const inbound = input.direction === "inbound";
  const outbound = input.direction === "outbound";
  const recordingOn = inbound
    ? settings.recordingEnabledInbound
    : outbound
      ? settings.recordingEnabledOutbound
      : settings.recordingEnabledInbound || settings.recordingEnabledOutbound;
  if (!recordingOn) return;

  await speakOnCall(
    input.customerCallControlId,
    DEFAULT_TEXT,
    undefined,
    input.sessionId,
  );
}
