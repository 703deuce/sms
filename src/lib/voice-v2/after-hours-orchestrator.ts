import "server-only";

import type { VoiceV2CallContext } from "./intake/types";
import type { VoiceV2PublishedAfterHoursHandlingConfig } from "./after-hours-handling-types";
import { evaluateUrgencyForContext, urgencyHandlingActionForRule } from "./urgency-evaluator";
import { readCallerClassification, blocksCustomerBookingForClassification } from "./spam-handling";
import { intakeFieldValue } from "./deterministic-rules";

export function applyAfterHoursEvaluations(
  ctx: VoiceV2CallContext,
  config: VoiceV2PublishedAfterHoursHandlingConfig,
): VoiceV2CallContext {
  const urgency = evaluateUrgencyForContext(ctx, config);
  const classification = readCallerClassification(ctx);
  let customerStatus = intakeFieldValue(ctx, config.customerStatusFieldKey).toUpperCase();
  if (!customerStatus && config.distinguishCustomerStatus) {
    customerStatus = "UNKNOWN";
  }

  const urgencyAction = urgencyHandlingActionForRule(config, urgency.matchedRuleId);
  const bookingBlocked = blocksCustomerBookingForClassification(config, classification);

  return {
    ...ctx,
    afterHours: {
      ...ctx.afterHours,
      urgency,
      callerClassification: classification,
      pendingHandlingAction:
        urgencyAction && urgency.status !== "NORMAL"
          ? urgencyAction
          : ctx.afterHours?.pendingHandlingAction,
    },
    capabilities: {
      ...ctx.capabilities,
      bookingEnabled:
        bookingBlocked ? false : ctx.capabilities?.bookingEnabled,
      voiceV2PstnLiveBooking:
        bookingBlocked ? false : ctx.capabilities?.voiceV2PstnLiveBooking,
    },
  };
}
