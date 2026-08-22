import "server-only";

import {
  MCTB_CONSENT_MODE_EXISTING,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import { loadMctbWorkspaceConfig } from "@/lib/mctb/config";
import { loadMctbConsentPrompt } from "@/lib/mctb/consent-prompt/store";
import { DEFAULT_MCTB_CONSENT_VOICE_ID } from "@/lib/mctb/consent-prompt/defaults";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { getImmediate571ConsentGather } from "@/lib/smart-routing/platform-consent-fast-path";
import { generatePromptAudio, publicPlaybackUrl } from "@/lib/smart-routing/media-service";
import { resolveSmsConsentPlayback } from "@/lib/smart-routing/prompt-playback";
import {
  normalizeForwardedFromE164,
  parseTelnyxForwardedFrom,
} from "@/lib/voice/telnyx/forwarded-from";

const FALLBACK_WORKSPACE_ID =
  process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "cmt2zyg4l43373s0f146b442h";

const MCTB_PRESS_1_CONFIRMATION_TEXT =
  "Perfect. Check your phone. We have just sent you a message.";

let cachedConfirmationPlayback: { playUrl: string; expiresAt: number } | null = null;

async function resolveConfirmationPlayUrl(workspaceId: string): Promise<string | undefined> {
  const envAsset = process.env.MCTB_PLATFORM_CONFIRMATION_AUDIO_ASSET_ID?.trim();
  if (envAsset) {
    const url = publicPlaybackUrl(envAsset);
    if (url.startsWith("http")) return url;
  }
  if (cachedConfirmationPlayback && cachedConfirmationPlayback.expiresAt > Date.now()) {
    return cachedConfirmationPlayback.playUrl;
  }
  const ownerId = process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || workspaceId;
  const asset = await generatePromptAudio({
    workspaceId: ownerId,
    name: "MCTB Press-1 Confirmation",
    text: MCTB_PRESS_1_CONFIRMATION_TEXT,
    voiceId: DEFAULT_MCTB_CONSENT_VOICE_ID,
  });
  const playUrl = publicPlaybackUrl(asset.id);
  if (playUrl.startsWith("http")) {
    cachedConfirmationPlayback = { playUrl, expiresAt: Date.now() + 60 * 60 * 1000 };
    return playUrl;
  }
  return undefined;
}

export type ResolveMctbSipSessionInput = {
  callerE164: string;
  transovoNumberE164?: string;
  forwardedFromE164?: string | null;
  diversionHeader?: string | null;
  sipAttributes?: Record<string, string>;
};

export type ResolveMctbSipSessionResult = {
  ok: boolean;
  workspaceId: string;
  demoMode: boolean;
  consentMode: MctbConsentMode;
  consentDigit: string;
  playUrl?: string;
  confirmationPlayUrl?: string;
  confirmationText?: string;
  audioAssetId?: string;
  failClosed?: boolean;
  forwardedFromE164?: string | null;
  diversionHeader?: string | null;
  businessE164: string;
  error?: string;
};

function extractForwardedFromSipAttributes(
  attrs: Record<string, string>,
): { forwardedFromE164?: string; diversionHeader?: string } {
  for (const [key, value] of Object.entries(attrs)) {
    const lowered = key.toLowerCase();
    if (
      !lowered.includes("diversion") &&
      !lowered.includes("forward") &&
      !lowered.includes("history-info") &&
      !lowered.includes("redirected")
    ) {
      continue;
    }
    const raw = String(value || "").slice(0, 500);
    const forwardedFromE164 = normalizeForwardedFromE164(raw);
    if (forwardedFromE164 || raw) {
      return { forwardedFromE164, diversionHeader: raw || undefined };
    }
  }
  return {};
}

function resolveForwardedFrom(input: ResolveMctbSipSessionInput): {
  forwardedFromE164: string | null;
  diversionHeader: string | null;
} {
  const fromAttrs = input.sipAttributes ? extractForwardedFromSipAttributes(input.sipAttributes) : {};
  const fromExplicit = normalizeForwardedFromE164(input.forwardedFromE164 || "");
  const fromDiversion = normalizeForwardedFromE164(input.diversionHeader || "");
  const fromTelnyxShape = input.sipAttributes
    ? parseTelnyxForwardedFrom(input.sipAttributes as Record<string, unknown>)
    : undefined;

  const forwardedFromE164 =
    fromExplicit ||
    fromAttrs.forwardedFromE164 ||
    fromDiversion ||
    fromTelnyxShape ||
    null;

  const diversionHeader =
    input.diversionHeader ||
    fromAttrs.diversionHeader ||
    (forwardedFromE164 ? null : null);

  return { forwardedFromE164, diversionHeader };
}

export async function resolveMctbSipSessionForPython(
  input: ResolveMctbSipSessionInput,
): Promise<ResolveMctbSipSessionResult> {
  const callerE164 = String(input.callerE164 || "").trim();
  const transovoNumberE164 = String(
    input.transovoNumberE164 || MCTB_PLATFORM_DEMO_E164,
  ).trim();
  if (!callerE164 || !transovoNumberE164) {
    return {
      ok: false,
      workspaceId: FALLBACK_WORKSPACE_ID,
      demoMode: false,
      consentMode: "press_1",
      consentDigit: "1",
      businessE164: transovoNumberE164,
      error: "missing_caller_or_transovo_number",
    };
  }

  const { forwardedFromE164, diversionHeader } = resolveForwardedFrom(input);
  const target = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164,
    businessE164: transovoNumberE164,
    fallbackWorkspaceId: FALLBACK_WORKSPACE_ID,
    forwardedFrom: forwardedFromE164,
  });

  const mctbConfig = await loadMctbWorkspaceConfig(target.workspaceId, {
    callerE164,
    transovoNumberE164,
  });
  const consentMode = mctbConfig.consentMode;
  const businessE164 = forwardedFromE164 || transovoNumberE164;

  let playUrl: string | undefined;
  let confirmationPlayUrl: string | undefined;
  let audioAssetId: string | undefined;
  let failClosed = false;

  if (consentMode !== MCTB_CONSENT_MODE_EXISTING) {
    const immediate = getImmediate571ConsentGather();
    if (immediate) {
      playUrl = immediate.playUrl;
      audioAssetId = immediate.audioAssetId;
    } else {
      const prompt = await loadMctbConsentPrompt(target.workspaceId);
      const publishedAssetId = String(
        prompt.publishedAudioAssetId || prompt.audioAssetId || "",
      ).trim();
      const playback = await resolveSmsConsentPlayback(target.workspaceId, {
        audioAssetId: publishedAssetId,
        promptAssetId: publishedAssetId,
        promptScriptHash: prompt.scriptHash,
        promptText: prompt.scriptText,
        text: prompt.scriptText,
      });
      if (playback.failClosed) {
        failClosed = true;
      } else {
        playUrl = playback.playUrl;
        audioAssetId = publishedAssetId || undefined;
      }
    }
    confirmationPlayUrl = await resolveConfirmationPlayUrl(target.workspaceId);
  }

  return {
    ok: true,
    workspaceId: target.workspaceId,
    demoMode: mctbConfig.demoMode,
    consentMode,
    consentDigit: "1",
    playUrl,
    confirmationPlayUrl,
    confirmationText: MCTB_PRESS_1_CONFIRMATION_TEXT,
    audioAssetId,
    failClosed,
    forwardedFromE164,
    diversionHeader,
    businessE164,
  };
}

export type RecordMctbSipPress1ConsentInput = {
  workspaceId: string;
  callerNumber: string;
  businessNumber: string;
  providerCallId: string;
  forwardedFrom?: string | null;
  audioAssetId?: string | null;
  dtmfDigit?: string;
};

export async function recordMctbSipPress1ConsentForPython(
  input: RecordMctbSipPress1ConsentInput,
) {
  const { recordSmsConsent, triggerMissedCallTextFromConsent } = await import(
    "@/lib/smart-routing/consent-service"
  );

  const digit = String(input.dtmfDigit || "1");
  const consent = await recordSmsConsent({
    workspaceId: input.workspaceId,
    callerNumber: input.callerNumber,
    businessNumber: input.businessNumber,
    affirmativeInput: digit,
    consentScope: "CUSTOMER_CARE_SMS",
    promptAssetId: input.audioAssetId || undefined,
    forwardedFrom: input.forwardedFrom || null,
    metadata: {
      path: "livekit_sip_mctb",
      providerCallId: input.providerCallId,
      forwardedFrom: input.forwardedFrom || null,
    },
  });

  const sms = await triggerMissedCallTextFromConsent({
    workspaceId: input.workspaceId,
    callerNumber: input.callerNumber,
    businessNumber: input.businessNumber,
    callSessionId: input.providerCallId,
    forwardedFrom: input.forwardedFrom || null,
  });

  return {
    ok: true,
    consentRecorded: true,
    duplicateConsent: consent.duplicate,
    sms,
  };
}
