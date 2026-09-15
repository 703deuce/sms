import "server-only";

import { getIntakeReadiness } from "./readiness";
import { ensureVoiceV2CallContext } from "./load-call-context";
import { getVoiceV2CallContext } from "./session-store";
import type { IntakeFieldKey } from "./types";

export type BookingIntakeGateResult =
  | { allowed: true }
  | { allowed: false; status: "MISSING_REQUIRED_FIELDS"; missing_fields: IntakeFieldKey[] };

/**
 * MUST_BLOCK_CURRENT_RESPONSE — thin gate immediately before Microsoft create.
 * Does not modify offer/slot/revalidation logic.
 */
export async function evaluateBookingIntakeGate(input: {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  fromE164?: string | null;
}): Promise<BookingIntakeGateResult> {
  const sessionKey = input.callControlId
    ? `cc:${input.callControlId.trim()}`
    : input.conversationId
      ? `conv:${input.conversationId.trim()}`
      : null;
  const ctx =
    (sessionKey ? getVoiceV2CallContext(sessionKey) : null) ||
    (await ensureVoiceV2CallContext({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callControlId: input.callControlId,
      conversationId: input.conversationId,
      fromE164: input.fromE164,
    }));

  if (!ctx) {
    return { allowed: true };
  }

  const readiness = getIntakeReadiness(ctx.intakeSchema, ctx.intakeState);
  if (readiness.missingBeforeBooking.length === 0) {
    return { allowed: true };
  }
  return {
    allowed: false,
    status: "MISSING_REQUIRED_FIELDS",
    missing_fields: readiness.missingBeforeBooking,
  };
}
