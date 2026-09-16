import "server-only";

import type { VoiceV2BookingStrategy } from "../booking-strategy";
import { voiceV2CalendlyRequiresEmail } from "../calendly-booking-config";
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
  bookingStrategy?: VoiceV2BookingStrategy;
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
  const strategy =
    input.bookingStrategy ?? ctx.capabilities?.bookingStrategy ?? "MICROSOFT_365";
  const missing = [...readiness.missingBeforeBooking];
  if (
    strategy === "CALENDLY" &&
    voiceV2CalendlyRequiresEmail() &&
    !ctx.intakeState.email?.value?.trim()
  ) {
    if (!missing.includes("email")) missing.push("email");
  }
  if (missing.length === 0) {
    return { allowed: true };
  }
  return {
    allowed: false,
    status: "MISSING_REQUIRED_FIELDS",
    missing_fields: missing,
  };
}
