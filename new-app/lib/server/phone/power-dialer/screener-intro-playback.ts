/**
 * M41 — Truthful screener introduction via Telnyx speak (TTS) before rep continues.
 * Recorded URL playback is supported when screenerIntroMode === "recorded".
 */

import { getPrisma } from "@/lib/server/db";
import { telnyxRequest } from "@/lib/server/telnyx/client";
import { telnyxCallControlPath } from "@/lib/server/phone/telnyx-call-actions";
import { getPowerDialerSettings } from "@/lib/server/phone/power-dialer";

const DEFAULT_TRUTHFUL_INTRO =
  "This is a live representative returning your call. I can wait while you connect me.";

export async function maybePlayScreenerIntro(input: {
  workspaceId: string;
  humanCallId: string;
  attemptId: string;
}) {
  const settings = await getPowerDialerSettings(input.workspaceId);
  const mode = settings.screenerIntroMode || "off";
  if (mode === "off" || !settings.callScreeningEnabled) {
    return { played: false, reason: "intro_disabled" };
  }

  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
    include: { humanCall: true },
  });
  const controlId = attempt?.humanCall?.telnyxCallControlId;
  if (!controlId) return { played: false, reason: "no_control_id" };

  const text = (settings.screenerIntroText || DEFAULT_TRUTHFUL_INTRO).trim();
  if (mode === "tts" && text) {
    if (process.env.POWER_DIALER_SCREENER_INTRO_MOCK === "1") {
      return { played: true, mode: "tts", mocked: true };
    }
    await telnyxRequest(telnyxCallControlPath(controlId, "/actions/speak"), {
      method: "POST",
      body: {
        payload: text,
        voice: "female",
        language: "en-US",
      },
    });
    await prisma.powerDialerAttempt.update({
      where: { id: input.attemptId },
      data: {
        notes: `${attempt?.notes || ""} screener_intro_played`.trim(),
      },
    });
    return { played: true, mode: "tts" };
  }

  if (mode === "recorded" && settings.screenerIntroAudioUrl) {
    if (process.env.POWER_DIALER_SCREENER_INTRO_MOCK === "1") {
      return { played: true, mode: "recorded", mocked: true };
    }
    await telnyxRequest(telnyxCallControlPath(controlId, "/actions/playback_start"), {
      method: "POST",
      body: { audio_url: settings.screenerIntroAudioUrl },
    });
    await prisma.powerDialerAttempt.update({
      where: { id: input.attemptId },
      data: {
        notes: `${attempt?.notes || ""} screener_intro_played`.trim(),
      },
    });
    return { played: true, mode: "recorded" };
  }

  return { played: false, reason: "misconfigured" };
}
