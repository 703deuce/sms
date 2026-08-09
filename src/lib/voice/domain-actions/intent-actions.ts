import { detectCallerIntent, intentToWorkflowNode } from "@/lib/voice/intent/detect";
import { patchSessionRuntimeExt } from "@/lib/voice/session-runtime/state";
import { structuredSuccess } from "@/lib/voice/tool-policy/structured-result";
import { guardToolInvocation } from "./guard";
import type { LiveKitCallContext } from "./session-bootstrap";
import type { DomainActionResult } from "./booking-actions";

export async function domainDetectCallerIntent(input: {
  ctx: LiveKitCallContext;
  utterance?: string | null;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "detect_caller_intent");
  if (blocked) return blocked;

  const detected = detectCallerIntent({
    utterance: input.utterance || input.ctx.session.lastUserUtterance,
    collectedFields: input.ctx.session.collectedFields,
  });

  input.ctx.session = patchSessionRuntimeExt(input.ctx.session, {
    callerIntent: detected.intent,
    currentTask:
      detected.intent === "reschedule"
        ? "RescheduleTask"
        : detected.intent === "cancel"
          ? "CancelTask"
          : detected.intent === "emergency"
            ? "TransferTask"
            : "CollectRequiredFieldsTask",
  });

  const nextNode = intentToWorkflowNode(detected.intent);

  return structuredSuccess({
    speak:
      detected.intent === "reschedule"
        ? "I can help you reschedule. Let me look up your appointment."
        : detected.intent === "cancel"
          ? "I can help cancel that appointment. Let me find it first."
          : detected.intent === "emergency"
            ? "I understand this is urgent. I'm connecting you with our on-call team."
            : "I can help with that.",
    data: {
      intent: detected.intent,
      confidence: detected.confidence,
      reason: detected.reason,
      nextNode,
      nextAllowedActions:
        detected.intent === "reschedule"
          ? ["find_appointments"]
          : detected.intent === "cancel"
            ? ["find_appointments"]
            : detected.intent === "emergency"
              ? ["request_human"]
              : ["record_current_field", "record_fields", "lookup_customer"],
    },
  });
}
