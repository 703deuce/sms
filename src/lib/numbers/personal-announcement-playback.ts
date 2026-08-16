/**
 * Telnyx announcement playback — custom audio URL or spoken fallback text.
 */

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { isTelnyxPhoneConfigured } from "@/lib/phone/human-call-service";
import type { PersonalCallSettings } from "./personal-call-settings";

export async function playPersonalAnnouncementOnTelnyx(
  telnyxCallControlId: string,
  callSettings: Pick<PersonalCallSettings, "announcementUrl" | "announcementText">,
  options?: { workspaceId?: string; humanCallId?: string },
): Promise<void> {
  if (!isTelnyxPhoneConfigured()) return;

  const audioUrl = callSettings.announcementUrl?.trim();
  if (audioUrl) {
    await telnyxRequest(`/calls/${telnyxCallControlId}/actions/playback_start`, {
      method: "POST",
      body: { audio_url: audioUrl },
    }).catch(() => undefined);

    if (options?.workspaceId) {
      try {
        const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
        await enqueueJob({
          jobType: "phone_announcement_hangup",
          queueName: "voice-calls",
          workspaceId: options.workspaceId,
          payload: {
            workspaceId: options.workspaceId,
            telnyxCallControlId,
            humanCallId: options.humanCallId || null,
          },
          idempotencyKey: `announcement-hangup-${telnyxCallControlId}`,
          runAfter: new Date(Date.now() + 120_000),
        });
      } catch {
        // ignore enqueue failure — caller may hang up manually
      }
    }
    return;
  }

  await telnyxRequest(`/calls/${telnyxCallControlId}/actions/speak`, {
    method: "POST",
    body: { payload: callSettings.announcementText, voice: "female", language: "en-US" },
  }).catch(() => undefined);
  await telnyxRequest(`/calls/${telnyxCallControlId}/actions/hangup`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);
}

export async function hangupTelnyxAnnouncementCall(
  telnyxCallControlId: string,
  humanCallId?: string | null,
): Promise<void> {
  if (!isTelnyxPhoneConfigured()) return;

  await telnyxRequest(`/calls/${telnyxCallControlId}/actions/hangup`, {
    method: "POST",
    body: {},
  }).catch(() => undefined);

  if (humanCallId) {
    const { getPrisma } = await import("@/lib/db");
    await getPrisma()
      .humanCall.updateMany({
        where: { id: humanCallId, status: { in: ["ringing", "queued", "initiated", "in-progress"] } },
        data: {
          status: "completed",
          disposition: "personal_announcement",
          endedAt: new Date(),
        },
      })
      .catch(() => undefined);
  }
}
