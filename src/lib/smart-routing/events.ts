import { emitPlatformEvent } from "@/lib/platform/events";
import type { SmartRoutingDomainEvent } from "./types";

export async function emitSmartRoutingEvent(input: {
  workspaceId: string;
  type: SmartRoutingDomainEvent;
  sessionId?: string;
  flowId?: string;
  contactId?: string;
  payload?: Record<string, unknown>;
}) {
  const platformType =
    input.type === "MISSED_CALL_TEXT_REQUESTED"
      ? "MESSAGE_SENT"
      : input.type === "SMS_CONSENT_CAPTURED"
        ? "CONTACT_CREATED"
        : input.type.startsWith("CALL") || input.type.includes("TRANSFER")
          ? "CALL_STARTED"
          : "AUTOMATION_STARTED";

  await emitPlatformEvent({
    workspaceId: input.workspaceId,
    type: platformType,
    contactId: input.contactId,
    callId: input.sessionId,
    payload: {
      smartRoutingEvent: input.type,
      flowId: input.flowId,
      ...input.payload,
    },
    idempotencyKey: `sr:${input.type}:${input.sessionId ?? "none"}:${input.payload?.digit ?? ""}`,
  });
}
