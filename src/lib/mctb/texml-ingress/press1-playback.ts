import "server-only";

import { isConsentAudioAssetReachable } from "@/lib/mctb/consent-prompt/audio-reachability";
import { loadMctbConsentPrompt } from "@/lib/mctb/consent-prompt/store";
import {
  getMctbConsentAudioAssetId,
  getMctbConsentPlaybackUrl,
} from "@/lib/mctb/consent-prompt/texml-response";
import { resolveSmsConsentPlayback } from "@/lib/smart-routing/prompt-playback";

const DEFAULT_PRESS_1_SAY =
  "Sorry we missed your call. To receive a text message from us, press 1 now.";

export type MctbPress1TexmlPlayback = {
  playUrl: string | null;
  sayText: string | null;
  failClosed: boolean;
};

/** Workspace Press-1 audio for TeXML &lt;Play&gt; inside &lt;Gather&gt;. */
export async function resolveMctbPress1TexmlPlayback(input: {
  workspaceId: string;
  demoMode?: boolean;
}): Promise<MctbPress1TexmlPlayback> {
  if (input.demoMode) {
    const { ensureTryItDemoVoiceReady } = await import("@/lib/mctb/try-it/demo-voice");
    try {
      const demoVoice = await ensureTryItDemoVoiceReady(input.workspaceId);
      if (demoVoice.consentPlayUrl) {
        return { playUrl: demoVoice.consentPlayUrl, sayText: null, failClosed: false };
      }
    } catch {
      // fall through
    }
    return { playUrl: null, sayText: DEFAULT_PRESS_1_SAY, failClosed: false };
  }

  const prompt = await loadMctbConsentPrompt(input.workspaceId);
  const publishedAssetId = String(
    prompt.publishedAudioAssetId || prompt.audioAssetId || "",
  ).trim();
  const playback = await resolveSmsConsentPlayback(input.workspaceId, {
    audioAssetId: publishedAssetId,
    promptAssetId: publishedAssetId,
    promptScriptHash: prompt.publishedScriptHash || prompt.scriptHash,
    promptText: prompt.scriptText,
    text: prompt.scriptText,
  });
  if (playback.failClosed) {
    return { playUrl: null, sayText: null, failClosed: true };
  }
  if (playback.playUrl) {
    return { playUrl: playback.playUrl, sayText: null, failClosed: false };
  }
  if (playback.sayText) {
    return { playUrl: null, sayText: playback.sayText, failClosed: false };
  }

  const platformAssetId = getMctbConsentAudioAssetId();
  if (await isConsentAudioAssetReachable(platformAssetId)) {
    return { playUrl: getMctbConsentPlaybackUrl(), sayText: null, failClosed: false };
  }

  const sayText = prompt.scriptText?.trim() || DEFAULT_PRESS_1_SAY;
  console.log(
    JSON.stringify({
      source: "mctb-press1-playback",
      event: "platform_audio_missing_say_fallback",
      workspaceId: input.workspaceId,
      platformAssetId,
      sayFallback: true,
    }),
  );
  return { playUrl: null, sayText, failClosed: false };
}
