import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_FQDN_DIRECT_TEST_E164 } from "@/lib/mctb/sip-diagnostic/constants";
import { checkMctbLegacyIngressBlocked } from "@/lib/mctb/ingress-policy";
import { handleMctbInboundEvent } from "@/lib/mctb/event-only/handle";
import { logMctbEventOnly } from "@/lib/mctb/event-only/logging";
import { normalizeTelnyxMctbInboundEvent } from "@/lib/mctb/event-only/normalize";
import {
  handleFqdnDirectGatherEnded,
  handleFqdnDirectSpeakEnded,
  resetFqdnDirectPress1StateForTests,
  startFqdnDirectPress1Gather,
  wasPress1ConsentCompleted,
  resolveCallControlVoiceContext,
} from "@/lib/mctb/event-only/fqdn-direct-press-1";
import {
  completeCallControlVoicemailRecording,
  handleCallControlVoicemailMediaEnded,
  clearCallControlVoicemailState,
  resetCallControlVoicemailStateForTests,
  wasCallControlVoicemailEngaged,
} from "@/lib/mctb/event-only/call-control-voicemail";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";

type TelnyxPayload = Record<string, unknown>;

const processedCalls = new Map<string, "captured" | "fqdn_press1" | "hangup_only">();

function normalizeDid(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.startsWith("+") ? value : null;
}

function isInbound(payload: TelnyxPayload): boolean {
  const direction = String(payload.direction || "").toLowerCase();
  return direction === "incoming" || direction === "inbound" || direction === "";
}

function isMctb571Target(to: string): boolean {
  return normalizeDid(to) === normalizeDid(MCTB_PLATFORM_DEMO_E164);
}

/**
 * Direct FQDN test toll-free — must NOT use platform 571.
 * Gate on called number only (866 is only on the direct FQDN connection).
 */
export function isFqdnDirectMctbTarget(payload: TelnyxPayload): boolean {
  const to = normalizeDid(String(payload.to || ""));
  const test = normalizeDid(MCTB_FQDN_DIRECT_TEST_E164);
  const platform = normalizeDid(MCTB_PLATFORM_DEMO_E164);
  if (!to || !test || to === platform) return false;
  return to === test;
}

/**
 * Call Control voice ingress (no LiveKit): platform 571 + FQDN direct test 866.
 * Same answer → press-1 / existing-consent capture path for both.
 */
export function isCallControlMctbVoiceIngress(payload: TelnyxPayload): boolean {
  const to = String(payload.to || "");
  if (isMctb571Target(to)) return true;
  return isFqdnDirectMctbTarget(payload);
}

function isMctbEventOnlyTarget(payload: TelnyxPayload): boolean {
  const to = String(payload.to || "");
  if (isMctb571Target(to)) return true;
  return isFqdnDirectMctbTarget(payload);
}

async function resolvesMctbEventOnlyIngress(payload: TelnyxPayload): Promise<boolean> {
  if (isMctbEventOnlyTarget(payload)) return true;
  const to = normalizeDid(String(payload.to || ""));
  if (!to) return false;
  const { isMctbSipIngressTarget } = await import("@/lib/mctb/sip-ingress/resolver");
  return isMctbSipIngressTarget(to);
}

function captureMctbEventAsync(
  eventPayload: TelnyxPayload,
  lockWorkspaceId: string | undefined,
  voiceCaptureStatus: "EVENT_CAPTURED" | "VOICE_TERMINATION_FAILED",
): void {
  const normalized = normalizeTelnyxMctbInboundEvent(eventPayload, { voiceCaptureStatus });
  if (!normalized) return;
  void handleMctbInboundEvent(normalized, { lockWorkspaceId }).catch((err) => {
    logMctbEventOnly("inbound_capture_failed", {
      callControlId: eventPayload.call_control_id ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

function isCallAlreadyEndedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("90018") || msg.includes("Call has already ended");
}

async function answerInboundMctbLeg(
  callControlId: string,
  eventPayload: TelnyxPayload,
): Promise<{ answered: boolean; skippedReason?: string }> {
  logMctbEventOnly("telnyx_call_initiated", {
    callControlId,
    from: eventPayload.from,
    to: eventPayload.to,
    connectionId: eventPayload.connection_id ?? null,
    callControlVoice: true,
    livekitBypass: true,
  });

  const { answerCall } = await import("@/lib/smart-routing/telnyx-provider");
  try {
    const answerResult = await answerCall(callControlId);
    if ((answerResult as { mock?: boolean }).mock) {
      logMctbEventOnly("fqdn_direct_answer_mock_skipped", {
        callControlId,
        reason: "telnyx_call_control_not_configured",
        livekitRoomCreated: false,
      });
      throw new Error("Telnyx Call Control answer skipped (missing TELNYX_API_KEY)");
    }

    logMctbEventOnly("fqdn_direct_answer_sent", {
      callControlId,
      livekitRoomCreated: false,
    });
    return { answered: true };
  } catch (err) {
    if (isCallAlreadyEndedError(err)) {
      logMctbEventOnly("fqdn_direct_answer_late", {
        callControlId,
        error: err instanceof Error ? err.message : String(err),
        livekitRoomCreated: false,
      });
      return { answered: false, skippedReason: "call_already_ended" };
    }
    logMctbEventOnly("fqdn_direct_answer_failed", {
      callControlId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Telnyx EVENT_ONLY MCTB handler.
 * FQDN direct path: answer immediately on call.initiated (before slow DB work).
 */
export async function handleMctbEventOnlyTelnyxWebhook(input: {
  eventType: string;
  eventPayload: TelnyxPayload;
}): Promise<{ handled: boolean; action?: string; callEventId?: string }> {
  const blocked = checkMctbLegacyIngressBlocked("call_control_event_only");
  if (blocked) return { handled: false, action: "legacy_ingress_disabled" };

  const { eventType, eventPayload } = input;
  const callControlId = String(eventPayload.call_control_id || "");
  const inbound = isInbound(eventPayload);

  // Carrier no-answer forwards (AT&T Diversion) expire in ~2s. This webhook only
  // receives the shared MCTB Event Only Call Control app — answer before DB ingress.
  if (eventType === "call.initiated" && callControlId && inbound) {
    const answer = await answerInboundMctbLeg(callControlId, eventPayload);

    if (!processedCalls.has(callControlId)) {
      processedCalls.set(callControlId, "fqdn_press1");
      setTimeout(() => processedCalls.delete(callControlId), 10 * 60 * 1000);
    }

    if (!answer.answered && answer.skippedReason === "call_already_ended") {
      return {
        handled: true,
        action: "answer_skipped_call_ended",
      };
    }
  }

  const isIngress = await resolvesMctbEventOnlyIngress(eventPayload);
  const callControlVoice = isIngress;

  if (!callControlId || !isIngress || !inbound) {
    return { handled: false };
  }

  switch (eventType) {
    case "call.initiated": {
      return {
        handled: true,
        action: callControlVoice ? "fqdn_direct_answer" : "event_only_capture",
      };
    }
    case "call.answered": {
      if (callControlVoice) {
        try {
          const press1 = await startFqdnDirectPress1Gather({
            eventPayload,
          });
          return { handled: true, action: press1.action };
        } catch (err) {
          logMctbEventOnly("fqdn_direct_press1_start_failed", {
            callControlId,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      }
      return { handled: true, action: "ignored" };
    }
    case "call.gather.ended": {
      if (!callControlVoice) return { handled: true, action: "ignored" };
      const gather = await handleFqdnDirectGatherEnded({
        eventPayload,
      });
      return { handled: true, action: gather.action };
    }
    case "call.dtmf.received": {
      if (!callControlVoice) return { handled: true, action: "ignored" };
      const digit = String(eventPayload.digit ?? eventPayload.digits ?? "").trim();
      if (!digit) return { handled: true, action: "ignored" };
      const gather = await handleFqdnDirectGatherEnded({
        eventPayload: { ...eventPayload, digits: digit },
      });
      return { handled: true, action: gather.action };
    }
    case "call.speak.ended": {
      if (!callControlVoice) return { handled: true, action: "ignored" };
      const vmSpeak = await handleCallControlVoicemailMediaEnded({ eventPayload });
      if (vmSpeak.handled) return { handled: true, action: vmSpeak.action };
      const speak = await handleFqdnDirectSpeakEnded({ eventPayload });
      return { handled: true, action: speak.action };
    }
    case "call.playback.ended": {
      if (!callControlVoice) return { handled: true, action: "ignored" };
      const vmPlayback = await handleCallControlVoicemailMediaEnded({ eventPayload });
      return { handled: true, action: vmPlayback.action || "playback_ignored" };
    }
    case "call.recording.saved": {
      if (!callControlVoice) return { handled: true, action: "ignored" };
      const vmSaved = await completeCallControlVoicemailRecording({ eventPayload });
      if (vmSaved.handled) return { handled: true, action: vmSaved.action };
      return { handled: true, action: "recording_ignored" };
    }
    case "call.hangup": {
      logMctbEventOnly("telnyx_call_hangup", {
        callControlId,
        hangupCause: eventPayload.hangup_cause ?? null,
        sipHangupCause: eventPayload.sip_hangup_cause ?? null,
        callControlVoice,
        livekitRoomCreated: false,
      });

      if (callControlVoice) {
        const voiceCtx = await resolveCallControlVoiceContext(eventPayload);
        if (
          !wasPress1ConsentCompleted(callControlId) &&
          voiceCtx?.consentMode === MCTB_CONSENT_MODE_EXISTING
        ) {
          if (!wasCallControlVoicemailEngaged(callControlId)) {
            logMctbEventOnly("existing_consent_hangup_before_voicemail", {
              callControlId,
              workspaceId: voiceCtx.workspaceId,
              livekitRoomCreated: false,
            });
            processedCalls.delete(callControlId);
            clearCallControlVoicemailState(callControlId);
            return { handled: true, action: "existing_consent_hangup_no_voicemail" };
          }
          captureMctbEventAsync(eventPayload, voiceCtx?.workspaceId, "EVENT_CAPTURED");
          processedCalls.delete(callControlId);
          clearCallControlVoicemailState(callControlId);
          return { handled: true, action: "call_control_existing_consent_capture" };
        }
        processedCalls.delete(callControlId);
        clearCallControlVoicemailState(callControlId);
        return { handled: true, action: "call_control_hangup" };
      }

      const prior = processedCalls.get(callControlId);
      if (prior === "captured") {
        captureMctbEventAsync(eventPayload, undefined, "VOICE_TERMINATION_FAILED");
        return { handled: true, action: "hangup_update_voice_status" };
      }

      const normalized = normalizeTelnyxMctbInboundEvent(eventPayload, {
        voiceCaptureStatus: "VOICE_TERMINATION_FAILED",
      });
      if (!normalized) return { handled: true, action: "hangup_invalid_payload" };

      const result = await handleMctbInboundEvent(normalized);
      processedCalls.set(callControlId, "captured");
      return {
        handled: true,
        action: "event_only_capture_on_hangup",
        callEventId: result.callEventId,
      };
    }
    default:
      logMctbEventOnly(`telnyx_${eventType.replace(/\./g, "_")}`, {
        callControlId,
        callControlVoice,
      });
      return { handled: true, action: "ignored" };
  }
}

export function resetMctbEventOnlyTelnyxStateForTests(): void {
  processedCalls.clear();
  resetFqdnDirectPress1StateForTests();
  resetCallControlVoicemailStateForTests();
}
