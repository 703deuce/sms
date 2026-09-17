import { buildLiveDelegationSessionPatch } from "./build-live-session-config";
import type { LiveBookingSessionState } from "./live-booking-session-state";
import { buildAuthoritativeBackendStatePayload } from "./live-booking-session-state";

/**
 * Push authoritative booking state into delegation.responses.instructions (RUNTIME / SESSION STATE).
 */
export function buildLiveDelegationRuntimeSessionUpdate(
  state: LiveBookingSessionState,
): Record<string, unknown> {
  const runtimeContext = JSON.stringify(buildAuthoritativeBackendStatePayload(state), null, 2);
  return {
    type: "session.update",
    session: buildLiveDelegationSessionPatch({ runtimeContext }),
  };
}
