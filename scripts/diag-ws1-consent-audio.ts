/**
 * Diagnose ws_1 Press-1 consent audio resolution and asset reachability.
 */
import { resolveMctbPress1TexmlPlayback } from "../src/lib/mctb/texml-ingress/press1-playback";
import { loadMctbConsentPrompt } from "../src/lib/mctb/consent-prompt/store";
import { readSmartRoutingAudioBytes } from "../src/lib/smart-routing/media-service";
import { getMctbConsentPlaybackUrl } from "../src/lib/mctb/consent-prompt/texml-response";
import { getPrisma } from "../src/lib/db";
import { getTelnyxWebhookUrls } from "../src/lib/messaging/telnyx/config";

const WS = "ws_1";
const E164_571 = "+15714073615";
const FORWARDED_FROM = process.env.MCTB_TEST_FORWARDED_FROM || "+15555550100"; // pragma: allowlist secret

async function main() {
  const prompt = await loadMctbConsentPrompt(WS);
  const playback = await resolveMctbPress1TexmlPlayback({ workspaceId: WS });
  const platformUrl = getMctbConsentPlaybackUrl();

  const assetIds = [
    prompt.publishedAudioAssetId,
    prompt.audioAssetId,
    "cmt3o8tyd1o5r0o4k3e4n5v2l",
    "cmt55oopl1y295a5y0k673g6t",
  ].filter(Boolean) as string[];

  const prisma = getPrisma();
  const assets = await prisma.smartRoutingAudioAsset.findMany({
    where: { id: { in: assetIds } },
  });

  const audioChecks: Record<string, { found: boolean; bytes: number }> = {};
  for (const id of assetIds) {
    const bytes = await readSmartRoutingAudioBytes(id);
    audioChecks[id] = { found: !!bytes, bytes: bytes?.bytes.length ?? 0 };
  }

  const entryUrl = getTelnyxWebhookUrls().mctbEntry;
  const entryRes = await fetch(entryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      From: "+15555550100",
      To: E164_571,
      CallSid: `diag-audio-${Date.now()}`,
      ForwardedFrom: FORWARDED_FROM,
    }),
  });
  const entryXml = await entryRes.text();

  const playMatch = entryXml.match(/<Play>([^<]+)<\/Play>/);
  const playUrl = playMatch?.[1]?.replace(/&amp;/g, "&") ?? null;

  let playUrlHttpStatus: number | null = null;
  if (playUrl) {
    try {
      const head = await fetch(playUrl, { method: "HEAD" });
      playUrlHttpStatus = head.status;
    } catch {
      playUrlHttpStatus = -1;
    }
  }

  console.log(
    JSON.stringify(
      {
        prompt: {
          publishedAudioAssetId: prompt.publishedAudioAssetId,
          audioAssetId: prompt.audioAssetId,
          audioStatus: prompt.audioStatus,
          publishedAt: prompt.publishedAt,
          publishedScriptHash: prompt.publishedScriptHash,
          scriptHash: prompt.scriptHash,
        },
        playback,
        platformUrl,
        assets: assets.map((a) => ({
          id: a.id,
          workspaceId: a.workspaceId,
          status: a.status,
          storageKey: a.storageKey,
        })),
        audioChecks,
        entryTeXML: {
          status: entryRes.status,
          playUrl,
          playUrlHttpStatus,
          usesSay: entryXml.includes("<Say"),
          preview: entryXml.slice(0, 500),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
