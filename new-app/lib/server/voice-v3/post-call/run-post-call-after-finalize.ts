import "server-only";

import { getPrisma } from "@/lib/server/db";
import { runVoiceV3PostCallSideEffects } from "./run-post-call-side-effects";
import { loadVoiceV3NotificationsConfigForCall } from "../notifications/load-config-for-call";
import { notifyVoiceV3CallCompleted } from "../notifications/notify-call-completed";

/** Golden-era post-call hooks after VoiceCall row is finalized (webhooks, gaps, notifications). */
export async function runVoiceV3PostCallAfterFinalize(input: {
  callId: string;
  workspaceId: string;
  summaryText: string;
}): Promise<void> {
  const summary = input.summaryText.trim();
  if (!summary) return;

  await runVoiceV3PostCallSideEffects({
    callId: input.callId,
    workspaceId: input.workspaceId,
    summaryText: summary,
  });

  try {
    const prisma = getPrisma();
    const call = await prisma.voiceCall.findFirst({
      where: { id: input.callId, workspaceId: input.workspaceId },
      select: {
        fromE164: true,
        toE164: true,
        durationSeconds: true,
        contactId: true,
      },
    });
    const loaded = await loadVoiceV3NotificationsConfigForCall(input.callId);
    if (!call || !loaded) return;

    const contact = call.contactId
      ? await prisma.contact.findFirst({
          where: { id: call.contactId, workspaceId: input.workspaceId },
          select: { firstName: true, lastName: true },
        })
      : null;
    const callerName = contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ")
      : null;

    await notifyVoiceV3CallCompleted({
      config: loaded.config,
      workspaceId: input.workspaceId,
      callId: input.callId,
      callerName,
      callerPhone: call.fromE164 || call.toE164 || "",
      durationSeconds: call.durationSeconds,
      summary,
    });
  } catch (err) {
    console.error("VOICE_V3_CALL_COMPLETED_NOTIFICATION_HOOK_FAILED", {
      callId: input.callId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
