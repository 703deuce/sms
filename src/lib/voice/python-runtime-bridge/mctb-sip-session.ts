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
import { generatePromptAudio, publicPlaybackUrl } from "@/lib/smart-routing/media-service";
import { resolveSmsConsentPlayback } from "@/lib/smart-routing/prompt-playback";
import {
  normalizeForwardedFromE164,
  parseTelnyxForwardedFrom,
} from "@/lib/voice/telnyx/forwarded-from";
import { getActiveMediaBackend } from "@/lib/voice/media-backend";
import { mediaBackendMetadataStamp } from "@/lib/voice/media-backend/pinning";
import { businessNumberForConsentStorage, consentIdentityMetadata } from "@/lib/mctb/consent-identity";

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
  const ownerId = workspaceId;
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

export type MctbSipHandlingMode = "mctb" | "voicemail_fallback";

export type ResolveMctbSipSessionResult = {
  ok: boolean;
  workspaceId: string;
  demoMode: boolean;
  consentMode: MctbConsentMode;
  consentDigit: string;
  mctbAutomationActive: boolean;
  handlingMode: MctbSipHandlingMode;
  playUrl?: string;
  confirmationPlayUrl?: string;
  confirmationText?: string;
  audioAssetId?: string;
  failClosed?: boolean;
  voicemailPlayUrl?: string;
  voicemailSayText?: string;
  directDialForwardE164?: string | null;
  directDialPromptText?: string | null;
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
      workspaceId: "",
      demoMode: false,
      consentMode: "press_1",
      consentDigit: "1",
      mctbAutomationActive: false,
      handlingMode: "voicemail_fallback",
      businessE164: transovoNumberE164,
      error: "missing_caller_or_transovo_number",
    };
  }

  const { forwardedFromE164, diversionHeader } = resolveForwardedFrom(input);
  const target = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164,
    businessE164: transovoNumberE164,
    forwardedFrom: forwardedFromE164,
  });
  if (!target.workspaceId) {
    return {
      ok: false,
      workspaceId: "",
      demoMode: false,
      consentMode: "press_1",
      consentDigit: "1",
      mctbAutomationActive: false,
      handlingMode: "voicemail_fallback",
      businessE164: forwardedFromE164 || transovoNumberE164,
      error: "workspace_unresolved",
    };
  }

  const mctbConfig = await loadMctbWorkspaceConfig(target.workspaceId, {
    callerE164,
    transovoNumberE164,
  });
  const consentMode = mctbConfig.consentMode;
  const businessE164 = forwardedFromE164 || transovoNumberE164;

  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const runtimeConfig = await loadMissedCallTextConfig(target.workspaceId);
  const { loadMctbScheduleSettings, isMctbAutomationActive } = await import("@/lib/mctb/schedule");
  const scheduleSettings = await loadMctbScheduleSettings(target.workspaceId, runtimeConfig);
  const mctbAutomationActive = isMctbAutomationActive(scheduleSettings, runtimeConfig);
  const handlingMode: MctbSipHandlingMode = mctbAutomationActive
    ? "mctb"
    : "voicemail_fallback";

  const { buildDirectDialForwardPromptText, resolveMctbDirectDialForwardE164 } = await import(
    "@/lib/mctb/direct-dial-prompt"
  );
  const directDialForwardE164 = mctbAutomationActive
    ? resolveMctbDirectDialForwardE164(runtimeConfig)
    : null;
  const directDialPromptText = mctbAutomationActive
    ? buildDirectDialForwardPromptText(runtimeConfig)
    : null;

  let playUrl: string | undefined;
  let confirmationPlayUrl: string | undefined;
  let audioAssetId: string | undefined;
  let failClosed = false;
  let voicemailPlayUrl: string | undefined;
  let voicemailSayText: string | undefined;

  const needsVoicemailGreeting =
    !mctbAutomationActive || consentMode === MCTB_CONSENT_MODE_EXISTING;
  if (needsVoicemailGreeting) {
    const { resolveMctbVoicemailFallbackPlayback } = await import(
      "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-fallback"
    );
    const voicemail = await resolveMctbVoicemailFallbackPlayback(
      target.workspaceId,
      transovoNumberE164,
    );
    voicemailPlayUrl = voicemail.playUrl || undefined;
    voicemailSayText = voicemail.sayText || undefined;
  }

  if (mctbAutomationActive && consentMode !== MCTB_CONSENT_MODE_EXISTING) {
    if (mctbConfig.demoMode) {
      const { ensureTryItDemoVoiceReady } = await import("@/lib/mctb/try-it/demo-voice");
      try {
        const demoVoice = await ensureTryItDemoVoiceReady(target.workspaceId);
        playUrl = demoVoice.consentPlayUrl;
        audioAssetId = demoVoice.consentAudioAssetId;
        confirmationPlayUrl = demoVoice.confirmationPlayUrl;
      } catch (err) {
        console.error("[mctb-sip-session] try_it_demo_voice_failed", err);
        failClosed = true;
      }
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
      } else if (playback.playUrl) {
        playUrl = playback.playUrl;
        audioAssetId = publishedAssetId || undefined;
      } else {
        failClosed = true;
      }
      confirmationPlayUrl = await resolveConfirmationPlayUrl(target.workspaceId);
    }
  }

  return {
    ok: true,
    workspaceId: target.workspaceId,
    demoMode: mctbConfig.demoMode,
    consentMode,
    consentDigit: "1",
    mctbAutomationActive,
    handlingMode,
    playUrl,
    confirmationPlayUrl,
    confirmationText: MCTB_PRESS_1_CONFIRMATION_TEXT,
    audioAssetId,
    failClosed,
    voicemailPlayUrl,
    voicemailSayText,
    directDialForwardE164,
    directDialPromptText,
    forwardedFromE164,
    diversionHeader,
    businessE164,
  };
}

export type RecordMctbSipPress1ConsentInput = {
  workspaceId: string;
  callerNumber: string;
  businessNumber: string;
  transovoNumberE164?: string;
  providerCallId: string;
  livekitRoomName?: string | null;
  forwardedFrom?: string | null;
  audioAssetId?: string | null;
  dtmfDigit?: string;
  /** Observability path override (default livekit_sip_mctb). */
  capturePath?: string;
};

export async function recordMctbSipPress1ConsentForPython(
  input: RecordMctbSipPress1ConsentInput,
) {
  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const { loadMctbScheduleSettings, isMctbAutomationActive } = await import("@/lib/mctb/schedule");
  const runtimeConfig = await loadMissedCallTextConfig(input.workspaceId);
  const scheduleSettings = await loadMctbScheduleSettings(input.workspaceId, runtimeConfig);
  if (!isMctbAutomationActive(scheduleSettings, runtimeConfig)) {
    return {
      ok: true,
      consentRecorded: false,
      duplicateConsent: false,
      sms: { ok: true, scheduled: false, eligible: false, reason: "FEATURE_DISABLED" },
      mctbAutomationSuppressed: true,
    };
  }

  const { recordSmsConsent, triggerMissedCallTextFromConsent } = await import(
    "@/lib/smart-routing/consent-service"
  );

  const digit = String(input.dtmfDigit || "1");
  const mediaBackend = getActiveMediaBackend();
  const transovoNumberE164 = String(input.transovoNumberE164 || input.businessNumber || "").trim();
  const observability = {
    path: input.capturePath?.trim() || "livekit_sip_mctb",
    captureMode: "SIP_INGRESS",
    consentMode: "press_1",
    providerCallId: input.providerCallId,
    transovoNumberE164,
    livekitRoomName: input.livekitRoomName || null,
    forwardedFrom: input.forwardedFrom || null,
    ...mediaBackendMetadataStamp(mediaBackend),
  };

  const consent = await recordSmsConsent({
    workspaceId: input.workspaceId,
    callerNumber: input.callerNumber,
    businessNumber: input.businessNumber,
    transovoIngressE164: transovoNumberE164,
    callSessionId: input.providerCallId,
    affirmativeInput: digit,
    consentScope: "CUSTOMER_CARE_SMS",
    promptAssetId: input.audioAssetId || undefined,
    forwardedFrom: input.forwardedFrom || null,
    hasDiversionHeader: Boolean(input.forwardedFrom),
    metadata: observability,
  });

  const sms = await triggerMissedCallTextFromConsent({
    workspaceId: input.workspaceId,
    callerNumber: consent.identity?.consentingCallerNumber || input.callerNumber,
    businessNumber: consent.identity
      ? businessNumberForConsentStorage(consent.identity)
      : input.businessNumber,
    callSessionId: input.providerCallId,
    forwardedFrom: input.forwardedFrom || null,
    consentIdentityVerified: consent.identity?.consentIdentityVerified ?? true,
    eventMetadata: {
      ...observability,
      ...(consent.identity ? consentIdentityMetadata(consent.identity) : {}),
    },
  });

  return {
    ok: true,
    consentRecorded: true,
    duplicateConsent: consent.duplicate,
    consentIdentityVerified: consent.identity?.consentIdentityVerified ?? true,
    sms,
  };
}
