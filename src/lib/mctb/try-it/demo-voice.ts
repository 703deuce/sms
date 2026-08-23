import "server-only";

import { getPrisma } from "@/lib/db";
import {
  defaultMctbConsentScript,
  DEFAULT_MCTB_CONSENT_VOICE_ID,
} from "@/lib/mctb/consent-prompt/defaults";
import {
  computeConsentScriptHash,
  loadMctbConsentPrompt,
  saveMctbConsentPrompt,
} from "@/lib/mctb/consent-prompt/store";
import {
  generateMctbConsentAudio,
  initMctbConsentPromptForWorkspace,
} from "@/lib/mctb/consent-prompt/service";
import {
  generatePromptAudio,
  publicPlaybackUrl,
  resolveAudioUrlForAsset,
} from "@/lib/smart-routing/media-service";

/** Existing-consent / voicemail-style line — pre-rendered ElevenLabs for Try It. */
export const TRY_IT_VM_GREETING_TEXT =
  "Hi, thanks for calling. Sorry we missed you. We will send you a text message shortly so we can help.";

const MCTB_PRESS_1_CONFIRMATION_TEXT =
  "Perfect. Check your phone. We have just sent you a message.";

export type TryItDemoVoiceAssets = {
  consentAudioAssetId: string;
  consentPlayUrl: string;
  vmAudioAssetId: string;
  vmPlayUrl: string;
  confirmationPlayUrl: string;
};

async function ensureElevenLabsAsset(input: {
  workspaceId: string;
  name: string;
  text: string;
  voiceId?: string;
}): Promise<{ assetId: string; playUrl: string }> {
  const voiceId = input.voiceId || DEFAULT_MCTB_CONSENT_VOICE_ID;
  const asset = await generatePromptAudio({
    workspaceId: input.workspaceId,
    name: input.name,
    text: input.text,
    voiceId,
  });
  const playUrl = await resolveAudioUrlForAsset(input.workspaceId, asset.id);
  if (!playUrl) {
    throw new Error(`try_it_elevenlabs_asset_unreachable:${asset.id}`);
  }
  return { assetId: asset.id, playUrl };
}

let cachedConfirmation: { playUrl: string; expiresAt: number } | null = null;

async function resolveTryItConfirmationPlayUrl(workspaceId: string): Promise<string> {
  const envAsset = process.env.MCTB_PLATFORM_CONFIRMATION_AUDIO_ASSET_ID?.trim();
  if (envAsset) {
    const url = publicPlaybackUrl(envAsset);
    if (url.startsWith("http")) return url;
  }
  if (cachedConfirmation && cachedConfirmation.expiresAt > Date.now()) {
    return cachedConfirmation.playUrl;
  }
  const ownerId = process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || workspaceId;
  const { playUrl } = await ensureElevenLabsAsset({
    workspaceId: ownerId,
    name: "MCTB Try It Press-1 Confirmation",
    text: MCTB_PRESS_1_CONFIRMATION_TEXT,
  });
  cachedConfirmation = { playUrl, expiresAt: Date.now() + 60 * 60 * 1000 };
  return playUrl;
}

/**
 * Pre-generate ElevenLabs MP3 assets for Try It — Press-1 consent + VM greeting + confirmation.
 * Idempotent; safe to call on every Start Test.
 */
export async function ensureTryItDemoVoiceReady(
  workspaceId: string,
): Promise<TryItDemoVoiceAssets> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, displayName: true },
  });
  const businessName = ws?.displayName || ws?.name || "our team";

  await initMctbConsentPromptForWorkspace(workspaceId);

  let config = await loadMctbConsentPrompt(workspaceId);
  const press1Script = defaultMctbConsentScript(businessName);
  if (config.scriptText !== press1Script || !config.audioAssetId) {
    config = await generateMctbConsentAudio(workspaceId, {
      scriptText: press1Script,
      voiceId: DEFAULT_MCTB_CONSENT_VOICE_ID,
    });
  } else if (config.audioStatus !== "ready" || !config.audioAssetId) {
    config = await generateMctbConsentAudio(workspaceId);
  }

  const consentPlayUrl = await resolveAudioUrlForAsset(workspaceId, config.audioAssetId);
  if (!consentPlayUrl || !config.audioAssetId) {
    throw new Error("try_it_consent_elevenlabs_missing");
  }

  const now = new Date().toISOString();
  const scriptHash =
    config.scriptHash ||
    computeConsentScriptHash(config.scriptText, config.voiceId, config.speed);
  await saveMctbConsentPrompt(workspaceId, {
    publishedAt: now,
    publishedScriptHash: scriptHash,
    publishedAudioAssetId: config.audioAssetId,
  });

  const [vmAsset, confirmationPlayUrl] = await Promise.all([
    ensureElevenLabsAsset({
      workspaceId,
      name: "MCTB Try It VM Greeting",
      text: TRY_IT_VM_GREETING_TEXT,
    }),
    resolveTryItConfirmationPlayUrl(workspaceId),
  ]);

  return {
    consentAudioAssetId: config.audioAssetId,
    consentPlayUrl,
    vmAudioAssetId: vmAsset.assetId,
    vmPlayUrl: vmAsset.playUrl,
    confirmationPlayUrl,
  };
}
