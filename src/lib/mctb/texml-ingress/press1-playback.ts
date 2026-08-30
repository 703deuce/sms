import "server-only";

import { getMctbConsentPlaybackUrl } from "@/lib/mctb/consent-prompt/texml-response";

const DEFAULT_PRESS_1_SAY =
  "Sorry we missed your call. To receive a text message from us, press 1 now.";

export type MctbPress1TexmlPlayback = {
  playUrl: string | null;
  sayText: string | null;
  failClosed: boolean;
};

/**
 * Press-1 consent audio for TeXML &lt;Play&gt; inside &lt;Gather&gt;.
 * Production uses the platform-standard clip only (not user-customizable).
 * Try-it demo mode may use workspace-generated preview audio.
 */
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

  return { playUrl: getMctbConsentPlaybackUrl(), sayText: null, failClosed: false };
}
