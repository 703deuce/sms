import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { DEFAULT_MCTB_CONSENT_VOICE_ID } from "@/lib/mctb/consent-prompt/defaults";
import { ensureNumberVoicemailBox } from "@/lib/phone/voicemail-service";
import { generatePromptAudio, publicPlaybackUrl } from "@/lib/smart-routing/media-service";

const DEFAULT_GREETING_TEXT = "Please leave a message after the tone.";

export type MctbVoicemailProvisionResult = {
  boxId: string;
  greetingPlayUrl: string | null;
  greetingSayText: string | null;
  greetingAssetId: string | null;
};

/**
 * Ensure an MCTB workspace has a voicemail box for its Transovo ingress DID,
 * with a pre-generated ElevenLabs greeting (not generated at call time).
 */
export async function ensureMctbVoicemailBoxProvisioned(
  workspaceId: string,
  transovoNumberE164: string,
): Promise<MctbVoicemailProvisionResult | null> {
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

  if (!phone) return null;

  let box = await ensureNumberVoicemailBox(workspaceId, phone.id);
  const greetingText = box.greetingText?.trim() || DEFAULT_GREETING_TEXT;

  const existingAssetId = box.greetingUrl
    ? box.greetingUrl.match(/smart-routing-audio\/([a-z0-9]+)/i)?.[1] ?? null
    : null;
  if (existingAssetId) {
    const playUrl = publicPlaybackUrl(existingAssetId);
    return {
      boxId: box.id,
      greetingPlayUrl: playUrl.startsWith("http") ? playUrl : null,
      greetingSayText: playUrl.startsWith("http") ? null : greetingText,
      greetingAssetId: existingAssetId,
    };
  }

  const asset = await generatePromptAudio({
    workspaceId,
    name: "MCTB Voicemail Greeting",
    text: greetingText,
    voiceId: DEFAULT_MCTB_CONSENT_VOICE_ID,
  });
  const playUrl = publicPlaybackUrl(asset.id);
  const greetingUrl = playUrl.startsWith("http") ? playUrl : `/smart-routing-audio/${asset.id}.mp3`;

  box = await prisma.voicemailBox.update({
    where: { id: box.id },
    data: {
      greetingText,
      greetingUrl,
      active: true,
    },
  });

  return {
    boxId: box.id,
    greetingPlayUrl: playUrl.startsWith("http") ? playUrl : null,
    greetingSayText: playUrl.startsWith("http") ? null : greetingText,
    greetingAssetId: asset.id,
  };
}
