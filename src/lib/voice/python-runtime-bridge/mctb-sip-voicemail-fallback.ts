import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { resolveVoicemailGreetingPlayback } from "@/lib/phone/voicemail-greeting-playback";
import { publicPlaybackUrl } from "@/lib/smart-routing/media-service";

export type MctbVoicemailFallbackPlayback = {
  playUrl: string | null;
  sayText: string | null;
};

export async function resolveMctbVoicemailFallbackPlayback(
  workspaceId: string,
  transovoNumberE164: string,
): Promise<MctbVoicemailFallbackPlayback> {
  const prisma = getPrisma();
  let normalized: string | null = null;
  try {
    normalized = normalizeE164(transovoNumberE164);
  } catch {
    normalized = transovoNumberE164.trim() || null;
  }

  const phone = normalized
    ? await prisma.phoneNumber.findFirst({
        where: {
          workspaceId,
          OR: [{ e164: transovoNumberE164 }, { e164: normalized }],
        },
        select: { id: true },
      })
    : null;

  let box = phone
    ? await prisma.voicemailBox.findFirst({
        where: { workspaceId, phoneNumberId: phone.id, active: true },
      })
    : null;

  if (!box && phone) {
    const { ensureNumberVoicemailBox } = await import("@/lib/phone/voicemail-service");
    box = await ensureNumberVoicemailBox(workspaceId, phone.id);
  }

  if (!box) {
    box = await prisma.voicemailBox.findFirst({
      where: { workspaceId, active: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!box) {
    return {
      playUrl: null,
      sayText: "Please leave a message after the tone.",
    };
  }

  const playback = await resolveVoicemailGreetingPlayback(workspaceId, box);
  if (playback.playUrl) {
    return { playUrl: playback.playUrl, sayText: null };
  }

  const sayText = playback.sayText?.trim() || "Please leave a message after the tone.";

  // Never generate TTS on the inbound hot path — that adds multi-second dead air.
  const defaultAssetId = process.env.MCTB_DEFAULT_VOICEMAIL_GREETING_AUDIO_ASSET_ID?.trim();
  if (defaultAssetId) {
    const playUrl = publicPlaybackUrl(defaultAssetId);
    if (playUrl.startsWith("http")) {
      return { playUrl, sayText: null };
    }
  }

  return { playUrl: null, sayText };
}
