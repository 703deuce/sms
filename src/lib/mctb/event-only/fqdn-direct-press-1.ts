import "server-only";

import { MCTB_CONSENT_MODE_EXISTING, isVerifiedCallConsentMode } from "@/lib/mctb/consent-mode";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { loadMctbConsentPrompt } from "@/lib/mctb/consent-prompt/store";
import { loadMctbWorkspaceConfig } from "@/lib/mctb/config";
import { logMctbEventOnly } from "@/lib/mctb/event-only/logging";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";
import { businessNumberForConsentStorage } from "@/lib/mctb/consent-identity";
import { parseTelnyxForwardedFrom, hasDiversionHeaderInPayload } from "@/lib/voice/telnyx/forwarded-from";
import { resolveSmsConsentPlayback } from "@/lib/smart-routing/prompt-playback";
import { resolveMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";

const FALLBACK_WORKSPACE_ID = resolveMctbPlatformOwnerWorkspaceId();

const DEFAULT_PRESS_1_SAY =
  "Sorry we missed your call. To receive a text message from us, press 1 now.";

const PRESS_1_CONFIRMATION_SAY =
  "Perfect. Check your phone. We have just sent you a message.";

export type CallContext = {
  workspaceId: string;
  demoMode: boolean;
  consentMode: string;
  callerE164: string;
  transovoE164: string;
  forwardedFrom: string | null;
  audioAssetId: string | null;
};

type CallPhase = "gathering" | "confirmed" | "hungup";

const contextByCall = new Map<string, CallContext>();
const phaseByCall = new Map<string, Set<CallPhase>>();

function markPhase(callControlId: string, phase: CallPhase): boolean {
  let set = phaseByCall.get(callControlId);
  if (!set) {
    set = new Set();
    phaseByCall.set(callControlId, set);
  }
  if (set.has(phase)) return false;
  set.add(phase);
  setTimeout(() => {
    phaseByCall.delete(callControlId);
    contextByCall.delete(callControlId);
  }, 10 * 60 * 1000);
  return true;
}

function extractDigits(payload: Record<string, unknown>): string {
  return String(payload.digits ?? payload.digit ?? "").trim();
}

async function resolveCallContext(
  payload: Record<string, unknown>,
  fallbackWorkspaceId: string,
): Promise<CallContext | null> {
  const callControlId = String(payload.call_control_id || "");
  const cached = contextByCall.get(callControlId);
  if (cached) return cached;

  const callerE164 = String(payload.from || "").trim();
  const transovoE164 = String(payload.to || "").trim();
  if (!callerE164 || !transovoE164) return null;

  const forwardedFrom = parseTelnyxForwardedFrom(payload) || null;
  const target = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164,
    businessE164: transovoE164,
    fallbackWorkspaceId: fallbackWorkspaceId || FALLBACK_WORKSPACE_ID,
    forwardedFrom,
  });

  const [consentMode, mctbConfig] = await Promise.all([
    loadMctbConsentMode(target.workspaceId),
    loadMctbWorkspaceConfig(target.workspaceId, { callerE164, transovoNumberE164: transovoE164 }),
  ]);

  let audioAssetId: string | null = null;
  if (isVerifiedCallConsentMode(consentMode as "press_1" | "existing_consent")) {
    if (mctbConfig.demoMode) {
      const { ensureTryItDemoVoiceReady } = await import("@/lib/mctb/try-it/demo-voice");
      try {
        const demoVoice = await ensureTryItDemoVoiceReady(target.workspaceId);
        audioAssetId = demoVoice.consentAudioAssetId;
      } catch {
        audioAssetId = null;
      }
    } else {
      const prompt = await loadMctbConsentPrompt(target.workspaceId);
      audioAssetId = String(prompt.publishedAudioAssetId || prompt.audioAssetId || "").trim() || null;
    }
  }

  const ctx: CallContext = {
    workspaceId: target.workspaceId,
    demoMode: target.demoMode || mctbConfig.demoMode,
    consentMode,
    callerE164,
    transovoE164,
    forwardedFrom,
    audioAssetId,
  };
  contextByCall.set(callControlId, ctx);
  return ctx;
}

async function resolvePress1Playback(
  workspaceId: string,
  demoMode: boolean,
): Promise<{ playUrl?: string; sayText?: string; failClosed?: boolean }> {
  if (demoMode) {
    const { ensureTryItDemoVoiceReady } = await import("@/lib/mctb/try-it/demo-voice");
    const demoVoice = await ensureTryItDemoVoiceReady(workspaceId);
    if (demoVoice.consentPlayUrl) return { playUrl: demoVoice.consentPlayUrl };
    return { sayText: DEFAULT_PRESS_1_SAY };
  }

  const prompt = await loadMctbConsentPrompt(workspaceId);
  const publishedAssetId = String(prompt.publishedAudioAssetId || prompt.audioAssetId || "").trim();
  const playback = await resolveSmsConsentPlayback(workspaceId, {
    audioAssetId: publishedAssetId,
    promptAssetId: publishedAssetId,
    promptScriptHash: prompt.publishedScriptHash || prompt.scriptHash,
    promptText: prompt.scriptText,
    text: prompt.scriptText,
  });
  if (playback.failClosed) return { failClosed: true };
  if (playback.playUrl) return { playUrl: playback.playUrl };
  if (playback.sayText) return { sayText: playback.sayText };
  return { sayText: DEFAULT_PRESS_1_SAY };
}

export async function startFqdnDirectPress1Gather(input: {
  eventPayload: Record<string, unknown>;
  fallbackWorkspaceId: string;
}): Promise<{ action: string }> {
  const callControlId = String(input.eventPayload.call_control_id || "");
  const ctx = await resolveCallContext(input.eventPayload, input.fallbackWorkspaceId);
  if (!ctx) return { action: "missing_context" };

  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const { loadMctbScheduleSettings, isMctbAutomationActive } = await import("@/lib/mctb/schedule");
  const runtimeConfig = await loadMissedCallTextConfig(ctx.workspaceId);
  const scheduleSettings = await loadMctbScheduleSettings(ctx.workspaceId, runtimeConfig);
  if (!ctx.demoMode && !isMctbAutomationActive(scheduleSettings, runtimeConfig)) {
    const { startCallControlVoicemailFallback } = await import(
      "@/lib/mctb/event-only/call-control-voicemail"
    );
    return startCallControlVoicemailFallback({
      eventPayload: input.eventPayload,
      ctx,
    });
  }

  if (ctx.consentMode === MCTB_CONSENT_MODE_EXISTING) {
    logMctbEventOnly("fqdn_direct_existing_consent_skip_gather", {
      callControlId,
      workspaceId: ctx.workspaceId,
      livekitRoomCreated: false,
    });
    return { action: "existing_consent_no_gather" };
  }

  if (!isVerifiedCallConsentMode(ctx.consentMode as "press_1" | "existing_consent")) {
    return { action: "unknown_consent_mode" };
  }

  const playback = await resolvePress1Playback(ctx.workspaceId, ctx.demoMode);
  if (playback.failClosed) {
    logMctbEventOnly("fqdn_direct_press1_playback_fail_closed", {
      callControlId,
      workspaceId: ctx.workspaceId,
    });
    const { hangupCall } = await import("@/lib/smart-routing/telnyx-provider");
    await hangupCall(callControlId);
    return { action: "playback_fail_closed_hangup" };
  }

  const { gatherUsingAudioRaw, gatherUsingSpeakRaw } = await import(
    "@/lib/smart-routing/telnyx-provider"
  );
  const gatherOpts = {
    callControlId,
    validDigits: "1",
    timeoutMs: 15000,
  };
  if (playback.playUrl) {
    await gatherUsingAudioRaw({
      ...gatherOpts,
      audioUrl: playback.playUrl,
    });
  } else {
    await gatherUsingSpeakRaw({
      ...gatherOpts,
      text: playback.sayText || DEFAULT_PRESS_1_SAY,
      clientStateBase64: "",
    });
  }

  markPhase(callControlId, "gathering");
  logMctbEventOnly("fqdn_direct_press1_gather_sent", {
    callControlId,
    workspaceId: ctx.workspaceId,
    usesPlay: Boolean(playback.playUrl),
    livekitRoomCreated: false,
  });
  return { action: "press1_gather" };
}

export async function handleFqdnDirectGatherEnded(input: {
  eventPayload: Record<string, unknown>;
  fallbackWorkspaceId: string;
}): Promise<{ action: string }> {
  const callControlId = String(input.eventPayload.call_control_id || "");
  const phases = phaseByCall.get(callControlId);
  if (phases?.has("confirmed") || phases?.has("hungup")) {
    return { action: "already_processed" };
  }

  const digits = extractDigits(input.eventPayload);
  const status = String(input.eventPayload.status || "");
  const ctx = await resolveCallContext(input.eventPayload, input.fallbackWorkspaceId);
  if (!ctx) return { action: "missing_context" };

  const { speakOnCall, hangupCall } = await import("@/lib/smart-routing/telnyx-provider");

  if (digits !== "1") {
    logMctbEventOnly("fqdn_direct_press1_no_consent", {
      callControlId,
      digits: digits || null,
      status: status || null,
      workspaceId: ctx.workspaceId,
      livekitRoomCreated: false,
    });
    await hangupCall(callControlId);
    markPhase(callControlId, "hungup");
    return { action: digits ? "invalid_digit_hangup" : "timeout_hangup" };
  }

  logMctbEventOnly("fqdn_direct_press1_received", {
    callControlId,
    workspaceId: ctx.workspaceId,
    forwardedFrom: ctx.forwardedFrom,
    livekitRoomCreated: false,
  });

  const { recordSmsConsent, triggerMissedCallTextFromConsent } = await import(
    "@/lib/smart-routing/consent-service"
  );

  const consentMetadata = {
    path: "fqdn_direct_event_only",
    captureMode: "SIP_INGRESS",
    consentMode: ctx.consentMode,
    providerCallId: callControlId,
    transovoNumberE164: ctx.transovoE164,
    forwardedFrom: ctx.forwardedFrom,
    livekitRoomCreated: false,
  };

  const consent = await recordSmsConsent({
    workspaceId: ctx.workspaceId,
    callerNumber: ctx.callerE164,
    businessNumber: ctx.transovoE164,
    transovoIngressE164: ctx.transovoE164,
    callSessionId: callControlId,
    affirmativeInput: "1",
    consentScope: "CUSTOMER_CARE_SMS",
    forwardedFrom: ctx.forwardedFrom,
    hasDiversionHeader: hasDiversionHeaderInPayload(input.eventPayload),
    promptAssetId: ctx.audioAssetId || undefined,
    metadata: consentMetadata,
  });

  if (consent.identity?.consentIdentityVerified && (ctx.demoMode || ctx.forwardedFrom)) {
    const { resolveMctbConfiguredTriggerPhoneNumberId } = await import(
      "@/lib/mctb/resolve-inbound-phone-number"
    );
    const smsTriggerPhoneNumberId = await resolveMctbConfiguredTriggerPhoneNumberId(
      ctx.workspaceId,
    );
    const smsResult = await triggerMissedCallTextFromConsent({
      workspaceId: ctx.workspaceId,
      callerNumber: consent.identity.consentingCallerNumber || ctx.callerE164,
      businessNumber: businessNumberForConsentStorage(consent.identity),
      callSessionId: callControlId,
      forwardedFrom: ctx.forwardedFrom,
      consentIdentityVerified: true,
      phoneNumberId: smsTriggerPhoneNumberId,
      eventMetadata: consentMetadata,
    });
    logMctbEventOnly("fqdn_direct_press1_sms_triggered", {
      callControlId,
      workspaceId: ctx.workspaceId,
      smsTriggerPhoneNumberId,
      result: smsResult,
      livekitRoomCreated: false,
    });
  } else {
    logMctbEventOnly("fqdn_direct_press1_sms_skipped", {
      callControlId,
      workspaceId: ctx.workspaceId,
      reason: consent.identity?.consentIdentityVerified
        ? "no_forward_metadata"
        : "consent_identity_unverified",
      identityReason: consent.identity?.identityReason ?? null,
      livekitRoomCreated: false,
    });
  }

  if (markPhase(callControlId, "confirmed")) {
    await speakOnCall(callControlId, PRESS_1_CONFIRMATION_SAY);
    logMctbEventOnly("fqdn_direct_press1_confirmation_sent", { callControlId });
  }
  return { action: "press1_consent_recorded" };
}

export async function handleFqdnDirectSpeakEnded(input: {
  eventPayload: Record<string, unknown>;
}): Promise<{ action: string }> {
  const callControlId = String(input.eventPayload.call_control_id || "");
  const phases = phaseByCall.get(callControlId);
  if (!phases?.has("confirmed")) return { action: "ignored" };

  if (markPhase(callControlId, "hungup")) {
    const { hangupCall } = await import("@/lib/smart-routing/telnyx-provider");
    await hangupCall(callControlId);
    logMctbEventOnly("fqdn_direct_press1_hangup_sent", {
      callControlId,
      livekitRoomCreated: false,
    });
    return { action: "confirmation_hangup" };
  }
  return { action: "hangup_duplicate_ignored" };
}

export function wasPress1ConsentCompleted(callControlId: string): boolean {
  return phaseByCall.get(callControlId)?.has("confirmed") ?? false;
}

export async function resolveCallControlVoiceContext(
  payload: Record<string, unknown>,
  fallbackWorkspaceId: string,
): Promise<CallContext | null> {
  return resolveCallContext(payload, fallbackWorkspaceId);
}

/** Test helper */
export function resetFqdnDirectPress1StateForTests(): void {
  contextByCall.clear();
  phaseByCall.clear();
}
