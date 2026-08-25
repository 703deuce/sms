import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { DEFAULT_MCTB_CONSENT_VOICE_ID } from "@/lib/mctb/consent-prompt/defaults";
import { resolveVoicemailGreetingPlayback } from "@/lib/phone/voicemail-greeting-playback";
import { generatePromptAudio, publicPlaybackUrl } from "@/lib/smart-routing/media-service";

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
  const asset = await generatePromptAudio({
    workspaceId,
    name: "MCTB Voicemail Greeting",
    text: sayText,
    voiceId: DEFAULT_MCTB_CONSENT_VOICE_ID,
  });
  const playUrl = publicPlaybackUrl(asset.id);
  if (playUrl.startsWith("http")) {
    return { playUrl, sayText };
  }

  return { playUrl: null, sayText };
}
