import "server-only";

import { ensureMctbVoicemailBoxProvisioned } from "@/lib/mctb/voicemail-provisioning";
import { generatePromptAudio, publicPlaybackUrl } from "@/lib/smart-routing/media-service";
import { DEFAULT_MCTB_CONSENT_VOICE_ID } from "@/lib/mctb/consent-prompt/defaults";

export type MctbVoicemailFallbackPlayback = {
  playUrl: string | null;
  sayText: string | null;
  boxId: string | null;
};

/**
 * Resolve pre-provisioned voicemail greeting for MCTB SIP fallback.
 * Generates audio only as a recovery fallback when provisioning was missed.
 */
export async function resolveMctbVoicemailFallbackPlayback(
  workspaceId: string,
  transovoNumberE164: string,
): Promise<MctbVoicemailFallbackPlayback> {
  const provisioned = await ensureMctbVoicemailBoxProvisioned(workspaceId, transovoNumberE164);
  if (provisioned?.greetingPlayUrl) {
    return {
      playUrl: provisioned.greetingPlayUrl,
      sayText: null,
      boxId: provisioned.boxId,
    };
  }

  if (provisioned) {
    return {
      playUrl: null,
      sayText: provisioned.greetingSayText || "Please leave a message after the tone.",
      boxId: provisioned.boxId,
    };
  }

  const sayText = "Please leave a message after the tone.";
  const asset = await generatePromptAudio({
    workspaceId,
    name: "MCTB Voicemail Greeting (recovery)",
    text: sayText,
    voiceId: DEFAULT_MCTB_CONSENT_VOICE_ID,
  });
  const playUrl = publicPlaybackUrl(asset.id);
  if (playUrl.startsWith("http")) {
    return { playUrl, sayText, boxId: null };
  }

  return { playUrl: null, sayText, boxId: null };
}
