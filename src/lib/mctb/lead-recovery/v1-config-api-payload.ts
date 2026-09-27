import "server-only";

import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";
import {
  computeLeadRecoveryV1PolicyHealth,
  sendBookingLinkResolvable,
} from "@/lib/mctb/lead-recovery/v1-policy-health";

/** Default GET payload for /api/mctb/lead-recovery/config — V1, no direct-booking provider audits. */
export async function buildLeadRecoveryV1ConfigGetPayload(
  workspaceId: string,
  config: LeadRecoveryWorkspaceConfig,
) {
  const health = await computeLeadRecoveryV1PolicyHealth(workspaceId, config);
  const linkOk = await sendBookingLinkResolvable(workspaceId, config);

  return {
    config: {
      ...config,
      policyHealth: health.overall,
      scenarioHealth: health.scenarioHealth,
    },
    health,
    providers: {
      booking: {
        provider: "send_booking_link",
        connected: linkOk,
        ready: linkOk,
        reason: linkOk ? undefined : "missing_booking_link",
        calendarLabel: null,
        eventTypeLabel: null,
      },
      stripe: {
        connected: false,
        canCharge: false,
      },
    },
    knowledge: {
      approvedCount: 0,
      ready: false,
    },
  };
}
