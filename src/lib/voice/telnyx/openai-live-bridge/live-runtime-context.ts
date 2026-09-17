import "server-only";

import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { buildBusinessLocalClock } from "@/lib/voice/runtime-clock";
import { ensureVoiceV2CallContext } from "@/lib/voice-v2/intake/load-call-context";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";

/**
 * Authoritative date/time + light session snapshot for Responses backend instructions.
 * Voice V2 PSTN does not expose resolve_datetime — clock is injected (same as dynamic variables path).
 */
export async function buildLiveResponsesRuntimeContext(
  claims: RealtimeBridgeStreamClaims,
): Promise<{ runtimeContext: string; bookingContext?: string }> {
  const bookingCfg = await loadMctbAiBookingConfig(claims.workspaceId);
  const timezone = bookingCfg.timezone?.trim() || "America/New_York";
  const clock = buildBusinessLocalClock(timezone);

  const ctx = await ensureVoiceV2CallContext({
    workspaceId: claims.workspaceId,
    agentId: claims.agentId,
    callControlId: claims.callControlId,
    trustedPrismaCallId: claims.callId,
  });

  const runtimeContext = JSON.stringify(
    {
      authoritative_clock: clock,
      business_timezone: timezone,
      call_id: claims.callId,
      workspace_id: claims.workspaceId,
      agent_id: claims.agentId,
      intake_state_summary: ctx?.intakeState
        ? Object.fromEntries(
            Object.entries(ctx.intakeState).map(([k, v]) => [
              k,
              typeof v === "object" && v && "value" in v ? (v as { value?: unknown }).value : v,
            ]),
          )
        : {},
      booking_workflow: ctx?.bookingWorkflow ?? null,
    },
    null,
    2,
  );

  const bookingContext = JSON.stringify(
    {
      booking_strategy: ctx?.capabilities?.bookingStrategy ?? null,
      booking_enabled: ctx?.capabilities?.bookingEnabled ?? false,
      intake_enabled: ctx?.capabilities?.intakeEnabled ?? false,
    },
    null,
    2,
  );

  return { runtimeContext, bookingContext };
}
