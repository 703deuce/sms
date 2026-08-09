import {
  domainCancelAppointment,
  domainCheckAvailability,
  domainConfirmBooking,
  domainRescheduleAppointment,
  domainSelectSlot,
  domainValidateEligibility,
  type DomainActionResult,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
import { applyWorkflowNodeTransition } from "./node-transitions";
import { reconcileCanonicalWorkflowState } from "./canonical-state";
import { compileToolsForCallContext } from "./compile-for-call";
import { hasAvailableSlots, hasHeldSlot } from "./completion-guards";
import { resolveActiveWorkflowForAgent } from "./loader";
import { buildHeldSlotPayload } from "@/lib/voice/domain-actions/scheduling-session";
import { domainSubmitCallerInformation } from "@/lib/voice/domain-actions";
import { inferFieldsFromUtterance } from "./field-extraction";
import { prepareFieldsForPersistence } from "./field-persist";

export type AutoWorkflowAction = {
  toolName: string;
  ok: boolean;
  speak: string;
  result?: DomainActionResult;
};

function utteranceContainsSchedulingPreference(userText: string): boolean {
  return /tomorrow|morning|afternoon|thursday|friday|monday|tuesday|wednesday|saturday|sunday|available|next available|later in the week/i.test(
    userText,
  );
}

async function maybeAutoCheckAvailability(input: {
  ctx: LiveKitCallContext;
  userText: string;
  called: Set<string>;
  actions: AutoWorkflowAction[];
  callerIntent?: string | null;
}): Promise<LiveKitCallContext> {
  let ctx = input.ctx;
  if (input.called.has("check_availability")) return ctx;
  if (input.actions.some((a) => a.toolName === "check_availability")) return ctx;
  if (input.callerIntent === "reschedule" || input.callerIntent === "cancel") return ctx;
  if (/reschedule/i.test(input.userText)) return ctx;

  const { canonical, allowedToolNames } = compileToolsForCallContext(ctx);
  if (canonical?.expectedNextAction !== "check_availability") return ctx;
  if (!allowedToolNames.has("check_availability")) return ctx;
  if (hasAvailableSlots(ctx.session)) return ctx;

  const spoken =
    input.userText.trim() && utteranceContainsSchedulingPreference(input.userText)
      ? input.userText.trim()
      : "next available";

  const result = await domainCheckAvailability({ ctx, spoken });
  ctx = await applyToolResult({ ctx, toolName: "check_availability", result });
  input.actions.push({
    toolName: "check_availability",
    ok: result.ok,
    speak: result.speak,
    result,
  });
  return ctx;
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

/** Caller picked a slot from offered times (including ordinal / vague picks). */
export function utteranceIndicatesSlotSelection(userText: string): boolean {
  const lower = normalizeText(userText);
  if (!lower) return false;
  if (/\d{1,2}(:\d{2})?\s*(am|pm)/i.test(userText)) return true;
  return /\b(first|second|third|earlier|later|that one|that time|works for me|sounds good)\b/.test(
    lower,
  );
}

/** Caller explicitly confirmed a pending action. */
export function utteranceIndicatesExplicitConfirmation(userText: string): boolean {
  const lower = normalizeText(userText);
  if (!lower) return false;
  return /^(yes|yeah|yep|correct|that's right|that is right|please|go ahead|book it|reschedule it|cancel it)/.test(
    lower,
  ) || /\b(yes|please (book|reschedule|cancel)|that's correct|that is correct)\b/.test(lower);
}

function utteranceContainsStreetAddress(userText: string): boolean {
  return /\d{1,5}\s+[\w\s.]+(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way)/i.test(
    userText,
  );
}

function selectionUtteranceForAutoApply(userText: string, ctx: LiveKitCallContext): string {
  const lower = normalizeText(userText);
  if (/\bfirst\b/.test(lower)) return "the first one";
  if (/\bsecond\b/.test(lower)) return "the second one";
  if (/\bthird\b/.test(lower)) return "the third one";
  return userText.trim();
}

async function applyToolResult(input: {
  ctx: LiveKitCallContext;
  toolName: string;
  result: Awaited<ReturnType<typeof domainSelectSlot>>;
}): Promise<LiveKitCallContext> {
  const workflow =
    input.ctx.workflowDefinition ?? resolveActiveWorkflowForAgent(input.ctx.agentId).definition;
  await applyWorkflowNodeTransition({
    workflow,
    callId: input.ctx.callId,
    session: input.ctx.session,
    toolName: input.toolName,
    result: input.result,
  });
  const canonical = reconcileCanonicalWorkflowState({
    session: input.ctx.session,
    workflow,
    toolName: input.toolName,
    toolResult: input.result,
  });
  input.ctx.canonicalWorkflow = canonical;
  input.ctx.workflowState = canonical.legacyState;
  compileToolsForCallContext(input.ctx);
  return input.ctx;
}

/**
 * When the caller clearly completed a workflow step but the model did not invoke
 * the authoritative tool, apply the domain action from utterance semantics.
 * Same behavior on phone (voice-runtime) and text simulator.
 */
export async function autoApplyWorkflowActionsFromUtterance(input: {
  ctx: LiveKitCallContext;
  userText: string;
  toolsCalledThisTurn: string[];
}): Promise<{ ctx: LiveKitCallContext; actions: AutoWorkflowAction[] }> {
  const actions: AutoWorkflowAction[] = [];
  let ctx = input.ctx;
  const called = new Set(input.toolsCalledThisTurn);
  const { canonical, allowedToolNames } = compileToolsForCallContext(ctx);
  const expected = canonical?.expectedNextAction;
  const callerIntent = ctx.session.runtime.session_runtime?.callerIntent;

  if (
    !called.has("submit_caller_information") &&
    allowedToolNames.has("submit_caller_information") &&
    utteranceContainsStreetAddress(input.userText)
  ) {
    const inferred = inferFieldsFromUtterance({
      session: ctx.session,
      utterance: input.userText,
    });
    const prepared = prepareFieldsForPersistence({
      session: ctx.session,
      extracted: inferred,
      utterance: input.userText,
    });
    if (Object.keys(prepared.fields).length > 0) {
      const result = await domainSubmitCallerInformation({
        ctx,
        extractedFields: prepared.fields,
        utterance: input.userText,
      });
      ctx = await applyToolResult({ ctx, toolName: "submit_caller_information", result });
      actions.push({
        toolName: "submit_caller_information",
        ok: result.ok,
        speak: result.speak,
      });
    }
  }

  const { allowedToolNames: allowedAfterSubmit } = compileToolsForCallContext(ctx);

  if (
    !called.has("validate_eligibility") &&
    !actions.some((a) => a.toolName === "validate_eligibility") &&
    (allowedAfterSubmit.has("validate_eligibility") || utteranceContainsStreetAddress(input.userText)) &&
    utteranceContainsStreetAddress(input.userText)
  ) {
    const result = await domainValidateEligibility({
      ctx,
      address: input.userText.trim(),
    });
    ctx = await applyToolResult({ ctx, toolName: "validate_eligibility", result });
    actions.push({
      toolName: "validate_eligibility",
      ok: result.ok,
      speak: result.speak,
    });
  }

  ctx = await maybeAutoCheckAvailability({
    ctx,
    userText: input.userText,
    called,
    actions,
    callerIntent,
  });

  const { canonical: afterAvailability, allowedToolNames: allowedAfterAvailability } =
    compileToolsForCallContext(ctx);
  const expectedAfterAvailability = afterAvailability?.expectedNextAction;

  if (
    !called.has("select_slot") &&
    expectedAfterAvailability === "select_slot" &&
    allowedAfterAvailability.has("select_slot") &&
    hasAvailableSlots(ctx.session) &&
    !hasHeldSlot(ctx.session) &&
    utteranceIndicatesSlotSelection(input.userText)
  ) {
    const result = await domainSelectSlot({
      ctx,
      utterance: selectionUtteranceForAutoApply(input.userText, ctx),
    });
    ctx = await applyToolResult({ ctx, toolName: "select_slot", result });
    actions.push({
      toolName: "select_slot",
      ok: result.ok,
      speak: result.speak,
    });
  }

  const { canonical: afterSlot, allowedToolNames: allowedAfter } = compileToolsForCallContext(ctx);
  const expectedAfter = afterSlot?.expectedNextAction;

  if (
    !called.has("confirm_booking") &&
    !actions.some((a) => a.toolName === "confirm_booking") &&
    expectedAfter === "confirm_booking" &&
    allowedAfter.has("confirm_booking") &&
    hasHeldSlot(ctx.session) &&
    utteranceIndicatesExplicitConfirmation(input.userText) &&
    callerIntent !== "reschedule" &&
    callerIntent !== "cancel"
  ) {
    const result = await domainConfirmBooking({ ctx, confirmed: true });
    ctx = await applyToolResult({ ctx, toolName: "confirm_booking", result });
    actions.push({
      toolName: "confirm_booking",
      ok: result.ok,
      speak: result.speak,
    });
  }

  const { canonical: beforeModify, allowedToolNames: allowedModify } = compileToolsForCallContext(ctx);
  const held = buildHeldSlotPayload(ctx.session);
  const appointmentId =
    ctx.session.runtime.session_runtime?.foundAppointmentId?.trim() || "";

  if (
    !called.has("reschedule_appointment") &&
    !actions.some((a) => a.toolName === "reschedule_appointment") &&
    beforeModify?.expectedNextAction === "reschedule_appointment" &&
    allowedModify.has("reschedule_appointment") &&
    hasHeldSlot(ctx.session) &&
    appointmentId &&
    held?.start &&
    utteranceIndicatesExplicitConfirmation(input.userText)
  ) {
    const result = await domainRescheduleAppointment({
      ctx,
      appointmentId,
      newStartsAt: held.start,
      confirmed: true,
    });
    ctx = await applyToolResult({ ctx, toolName: "reschedule_appointment", result });
    actions.push({
      toolName: "reschedule_appointment",
      ok: result.ok,
      speak: result.speak,
    });
  }

  const { canonical: beforeCancel, allowedToolNames: allowedCancel } = compileToolsForCallContext(ctx);

  if (
    !called.has("cancel_appointment") &&
    !actions.some((a) => a.toolName === "cancel_appointment") &&
    beforeCancel?.expectedNextAction === "cancel_appointment" &&
    allowedCancel.has("cancel_appointment") &&
    appointmentId &&
    utteranceIndicatesExplicitConfirmation(input.userText)
  ) {
    const result = await domainCancelAppointment({
      ctx,
      appointmentId,
      confirmed: true,
    });
    ctx = await applyToolResult({ ctx, toolName: "cancel_appointment", result });
    actions.push({
      toolName: "cancel_appointment",
      ok: result.ok,
      speak: result.speak,
    });
  }

  return { ctx, actions };
}
