import "server-only";

import { performance } from "node:perf_hooks";

import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { buildBusinessLocalClock } from "@/lib/voice/runtime-clock";
import { ensureVoiceV2CallContext } from "@/lib/voice-v2/intake/load-call-context";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-v2/after-hours-handling-config";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";
import {
  buildLiveDelegationSessionPatch,
  buildLiveSessionConfig,
} from "./build-live-session-config";
import { buildOpenAiLiveSessionStartPayload, resolveOpenAiLiveGreetingLine } from "./live-config";
import { buildLiveVoiceTools } from "./live-tools";
import { createLiveToolDispatchContext } from "./live-tool-runtime";
import { isOpenAiLiveDelegationEnabled } from "./constants";
import type { LiveSessionReady } from "./live-media-bridge";

export type LiveSessionResolveProfile = {
  resolve_agent_config_ms: number;
  resolve_after_hours_ms: number;
  resolve_tool_context_ms: number;
  resolve_booking_config_ms: number;
  resolve_caller_context_ms: number;
  resolve_date_time_context_ms: number;
  build_runtime_context_ms: number;
  build_frontend_prompt_ms: number;
  build_backend_prompt_ms: number;
  build_tool_schema_ms: number;
  build_session_payload_ms: number;
  other_ms: number;
  total_ms: number;
};

function emptyProfile(): LiveSessionResolveProfile {
  return {
    resolve_agent_config_ms: 0,
    resolve_after_hours_ms: 0,
    resolve_tool_context_ms: 0,
    resolve_booking_config_ms: 0,
    resolve_caller_context_ms: 0,
    resolve_date_time_context_ms: 0,
    build_runtime_context_ms: 0,
    build_frontend_prompt_ms: 0,
    build_backend_prompt_ms: 0,
    build_tool_schema_ms: 0,
    build_session_payload_ms: 0,
    other_ms: 0,
    total_ms: 0,
  };
}

export type ResolvedOpenAiLiveSession = LiveSessionReady & {
  profile: LiveSessionResolveProfile;
  /** Partial session object for session.update (delegation + tools only). */
  delegationSessionPatch?: Record<string, unknown>;
};

/**
 * Loads agent config, CallContext, prompts, and tool schemas for session.start.
 * Emits per-phase timings — used to eliminate the ~4s pre-start bottleneck.
 */
export async function resolveOpenAiLiveSessionReady(input: {
  claims: RealtimeBridgeStreamClaims;
}): Promise<ResolvedOpenAiLiveSession> {
  const tTotal = performance.now();
  const profile = emptyProfile();
  const greeting = resolveOpenAiLiveGreetingLine();

  let t = performance.now();
  const runtime = await loadVoiceAgentRuntimeConfig(input.claims.workspaceId, input.claims.agentId);
  profile.resolve_agent_config_ms = Math.round(performance.now() - t);

  t = performance.now();
  const parsed = parseVoiceAgentConfig(runtime);
  const handling = resolveAfterHoursHandlingFromAgentConfig(parsed);
  profile.resolve_after_hours_ms = Math.round(performance.now() - t);

  t = performance.now();
  const toolContext = createLiveToolDispatchContext({
    claims: input.claims,
    config: parsed,
  });
  profile.resolve_tool_context_ms = Math.round(performance.now() - t);

  if (!isOpenAiLiveDelegationEnabled()) {
    profile.total_ms = Math.round(performance.now() - tTotal);
    const other =
      profile.total_ms -
      profile.resolve_agent_config_ms -
      profile.resolve_after_hours_ms -
      profile.resolve_tool_context_ms;
    profile.other_ms = Math.max(0, other);
    return {
      sessionStartPayload: buildOpenAiLiveSessionStartPayload(),
      toolContext,
      profile,
    };
  }

  t = performance.now();
  const bookingCfg = await loadMctbAiBookingConfig(input.claims.workspaceId);
  profile.resolve_booking_config_ms = Math.round(performance.now() - t);

  const timezone = bookingCfg.timezone?.trim() || "America/New_York";

  t = performance.now();
  const ctx = await ensureVoiceV2CallContext({
    workspaceId: input.claims.workspaceId,
    agentId: input.claims.agentId,
    callControlId: input.claims.callControlId,
    trustedPrismaCallId: input.claims.callId,
  });
  profile.resolve_caller_context_ms = Math.round(performance.now() - t);

  t = performance.now();
  const clock = buildBusinessLocalClock(timezone);
  profile.resolve_date_time_context_ms = Math.round(performance.now() - t);

  t = performance.now();
  const runtimeContext = JSON.stringify(
    {
      authoritative_clock: clock,
      business_timezone: timezone,
      call_id: input.claims.callId,
      workspace_id: input.claims.workspaceId,
      agent_id: input.claims.agentId,
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
  profile.build_runtime_context_ms = Math.round(performance.now() - t);

  t = performance.now();
  const tools = buildLiveVoiceTools({
    config: parsed,
    transferEnabled: Boolean(handling?.transferEnabled),
  });
  profile.build_tool_schema_ms = Math.round(performance.now() - t);

  t = performance.now();
  const session = buildLiveSessionConfig({
    greeting,
    bookingContext,
    runtimeContext,
    tools,
  });
  profile.build_session_payload_ms = Math.round(performance.now() - t);

  // Prompt build is inside buildLiveSessionConfig — approximate split for observability.
  profile.build_frontend_prompt_ms = 0;
  profile.build_backend_prompt_ms = 0;

  profile.total_ms = Math.round(performance.now() - tTotal);
  const accounted =
    profile.resolve_agent_config_ms +
    profile.resolve_after_hours_ms +
    profile.resolve_tool_context_ms +
    profile.resolve_booking_config_ms +
    profile.resolve_caller_context_ms +
    profile.resolve_date_time_context_ms +
    profile.build_runtime_context_ms +
    profile.build_tool_schema_ms +
    profile.build_session_payload_ms;
  profile.other_ms = Math.max(0, profile.total_ms - accounted);

  const delegationSessionPatch = buildLiveDelegationSessionPatch({
    bookingContext,
    runtimeContext,
    tools,
  });

  return {
    sessionStartPayload: buildOpenAiLiveSessionStartPayload(session),
    delegationSessionPatch,
    toolContext,
    profile,
  };
}
