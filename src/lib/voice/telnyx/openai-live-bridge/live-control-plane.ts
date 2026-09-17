import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { resolveAfterHoursHandlingFromAgentConfig } from "@/lib/voice-v2/after-hours-handling-config";
import { type VoiceV2NextStage, workflowFromContext } from "@/lib/voice-v2/booking-workflow";
import {
  patchWorkflowAfterBookConfirmed,
  patchWorkflowAfterFind,
  workflowPayloadForContext,
} from "@/lib/voice-v2/booking-workflow-hooks";
import { ensureVoiceV2CallContext } from "@/lib/voice-v2/intake/load-call-context";
import { getVoiceV2CallContext } from "@/lib/voice-v2/intake/session-store";
import { getIntakeReadiness } from "@/lib/voice-v2/intake/readiness";
import type { VoiceV2CallContext } from "@/lib/voice-v2/intake/types";
import { resolveSessionKey } from "@/lib/voice-v2/intake/load-call-context";
import {
  buildVoiceV2CallCapabilitySnapshot,
  type VoiceV2CallCapabilitySnapshot,
} from "@/lib/voice-v2/workflow-capability";
import { certifiedBookingHandoffPayload } from "@/lib/voice-v2/certified-booking-pipeline";
import type { RealtimeBridgeStreamClaims } from "../openai-realtime-bridge/stream-token";
import { buildLiveDelegationSessionPatch } from "./build-live-session-config";
import {
  filterLiveToolsForWorkflow,
  isToolNameAllowedByWorkflow,
} from "./live-workflow-tool-filter";
import type { LiveResponsesFunctionTool } from "./live-tools";
import { shouldBlockCallbackToolForContext } from "@/lib/voice-v2/dialog-goal";
import { VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

export type LiveControlPlane = {
  callId: string;
  setLiveSessionId(id: string): void;
  getLiveSessionId(): string | null;
  ensureHydrated(): Promise<VoiceV2CallContext | null>;
  invalidateContextCache(): void;
  getCallContext(): VoiceV2CallContext | null;
  getCapability(): VoiceV2CallCapabilitySnapshot;
  getAgentConfig(): VoiceAgentConfig | null;
  getStage(): VoiceV2NextStage;
  getWorkflowEnvelope(): Record<string, unknown>;
  getActiveTools(): LiveResponsesFunctionTool[];
  buildDelegationToolsSessionUpdate(): Record<string, unknown>;
  mergeWorkflowIntoToolOutput(toolOutput: Record<string, unknown>): Record<string, unknown>;
  gateToolName(toolName: string): { allowed: boolean; speak?: string; status?: string };
  afterFindSuccess(input: {
    requestedDate: string;
    offerSetId: string;
    slotIds: string[];
    slots: Array<{ slot_id: string; label: string; spoken_label?: string }>;
  }): Promise<void>;
  afterBookConfirmed(): Promise<void>;
  logStageTransitionIfChanged(): void;
  isBookingConfirmed(): boolean;
};

function sessionKeyForClaims(claims: RealtimeBridgeStreamClaims): string | null {
  return resolveSessionKey({
    callControlId: claims.callControlId,
    conversationId: claims.callControlId,
  });
}

export function shouldShortCircuitRedundantFindFromCallContext(
  mergedArgs: Record<string, unknown>,
  ctx: VoiceV2CallContext,
): boolean {
  const offer = ctx.currentOfferSet;
  if (!offer?.offerSetId || !(offer.slotIds?.length ?? 0)) return false;
  const date = String(mergedArgs.requested_date || mergedArgs.requestedDate || "").trim();
  const wf = workflowFromContext(ctx);
  if (date && wf.requestedDate && date !== wf.requestedDate) return false;
  if (date && wf.lastFindRequestedDate && date !== wf.lastFindRequestedDate && date !== wf.requestedDate) {
    return false;
  }
  return true;
}

export function createLiveControlPlane(input: {
  claims: RealtimeBridgeStreamClaims;
  initialConfig?: VoiceAgentConfig;
}): LiveControlPlane {
  let cachedCtx: VoiceV2CallContext | null = null;
  let agentConfig: VoiceAgentConfig | null = input.initialConfig ?? null;
  let capability = buildVoiceV2CallCapabilitySnapshot(agentConfig ?? {});
  let lastLoggedStage: VoiceV2NextStage | null = null;
  let liveSessionId: string | null = null;
  let transferEnabled = false;

  const hydrateConfig = async () => {
    if (agentConfig) return;
    const runtime = await loadVoiceAgentRuntimeConfig(
      input.claims.workspaceId,
      input.claims.agentId,
    );
    agentConfig = parseVoiceAgentConfig(runtime);
    capability = buildVoiceV2CallCapabilitySnapshot(agentConfig);
    const handling = resolveAfterHoursHandlingFromAgentConfig(agentConfig);
    transferEnabled = Boolean(handling?.transferEnabled);
  };

  const readContextFromStore = (): VoiceV2CallContext | null => {
    const key = sessionKeyForClaims(input.claims);
    if (!key) return null;
    return getVoiceV2CallContext(key) ?? cachedCtx;
  };

  const computeEnvelope = (ctx: VoiceV2CallContext | null): Record<string, unknown> => {
    if (!ctx) {
      return {
        voice_v2_next_stage: "COLLECT_REQUIRED_INTAKE",
        allowed_next_actions: ["voice_v2_save_intake_fields"],
        booking_continue_required: false,
        runtime_hint: "",
        forbidden_actions: [
          "voice_v2_find_availability",
          "voice_v2_book_offered_slot",
          "voice_v2_finalize_caller_request",
          "voice_v2_send_booking_link",
        ],
        required_action: null,
      };
    }
    const voiceV2PstnLiveBooking =
      ctx.capabilities?.voiceV2PstnLiveBooking ?? capability.voiceV2LiveBooking;
    const bookingStrategy =
      ctx.capabilities?.bookingStrategy ?? capability.bookingStrategy;
    return workflowPayloadForContext(ctx, voiceV2PstnLiveBooking, bookingStrategy);
  };

  const plane: LiveControlPlane = {
    callId: input.claims.callId,

    setLiveSessionId(id: string) {
      liveSessionId = id.trim() || null;
    },

    getLiveSessionId() {
      return liveSessionId;
    },

    invalidateContextCache() {
      cachedCtx = null;
    },

    async ensureHydrated() {
      await hydrateConfig();
      if (cachedCtx) return cachedCtx;
      const ctx = await ensureVoiceV2CallContext({
        workspaceId: input.claims.workspaceId,
        agentId: input.claims.agentId,
        callControlId: input.claims.callControlId,
        trustedPrismaCallId: input.claims.callId,
      });
      cachedCtx = ctx;
      return ctx;
    },

    getCallContext() {
      return readContextFromStore() ?? cachedCtx;
    },

    getCapability() {
      return capability;
    },

    getAgentConfig() {
      return agentConfig;
    },

    getStage() {
      const env = this.getWorkflowEnvelope();
      return (env.voice_v2_next_stage as VoiceV2NextStage) || "COLLECT_REQUIRED_INTAKE";
    },

    getWorkflowEnvelope() {
      return computeEnvelope(this.getCallContext());
    },

    getActiveTools() {
      if (!agentConfig) return [];
      const env = this.getWorkflowEnvelope();
      const allowed =
        (env.delegation_allowed_actions as string[]) ||
        (env.allowed_next_actions as string[]) ||
        [];
      return filterLiveToolsForWorkflow({
        config: agentConfig,
        capability,
        allowedActions: allowed,
        transferEnabled,
      });
    },

    buildDelegationToolsSessionUpdate() {
      const tools = this.getActiveTools();
      const env = this.getWorkflowEnvelope();
      return {
        type: "session.update",
        delegation_id: null,
        session: buildLiveDelegationSessionPatch({
          tools,
          runtimeContext: JSON.stringify(
            {
              workflow_control_plane: env,
              active_tool_names: tools.map((t) => t.name),
            },
            null,
            2,
          ),
        }),
      };
    },

    mergeWorkflowIntoToolOutput(toolOutput: Record<string, unknown>) {
      const env = this.getWorkflowEnvelope();
      const merged = { ...toolOutput, ...env };
      const status = String(toolOutput.voice_v2_status || toolOutput.status || "");
      if (status === "AVAILABILITY_FOUND" && toolOutput.offer_set_id) {
        const slotsRaw = Array.isArray(toolOutput.slots) ? toolOutput.slots : [];
        const slots = slotsRaw.map((s) => {
          const row = s as Record<string, unknown>;
          return {
            slot_id: String(row.slot_id || row.slotId || ""),
            label: String(row.label || row.spoken_label || ""),
            spoken_label: String(row.spoken_label || row.label || ""),
          };
        });
        Object.assign(
          merged,
          certifiedBookingHandoffPayload({
            offerSetId: String(toolOutput.offer_set_id),
            slots,
          }),
        );
      }
      return merged;
    },

    gateToolName(toolName: string) {
      if (
        toolName === VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE &&
        shouldBlockCallbackToolForContext(this.getCallContext())
      ) {
        return {
          allowed: false,
          speak: "Let's finish scheduling this appointment first.",
          status: "CALLBACK_BLOCKED_ACTIVE_BOOKING",
        };
      }
      const env = this.getWorkflowEnvelope();
      const runtimeOwned = (env.runtime_owned_actions as string[]) || [];
      if (runtimeOwned.includes(toolName)) {
        return {
          allowed: false,
          speak: "The system is already handling that step.",
          status: "RUNTIME_OWNS_REQUIRED_ACTION",
        };
      }
      const allowed = (env.allowed_next_actions as string[]) || [];
      if (!isToolNameAllowedByWorkflow(toolName, allowed)) {
        return {
          allowed: false,
          speak: "That step is not available for this part of the call yet.",
          status: "WORKFLOW_STAGE_BLOCKED",
        };
      }
      if (!agentConfig) {
        return { allowed: true };
      }
      const active = filterLiveToolsForWorkflow({
        config: agentConfig,
        capability,
        allowedActions: allowed,
        transferEnabled,
      });
      if (!active.some((t) => t.name === toolName)) {
        return {
          allowed: false,
          speak: "That action is not enabled on this line.",
          status: "TOOL_NOT_EXPOSED",
        };
      }
      return { allowed: true };
    },

    async afterFindSuccess(findInput) {
      await patchWorkflowAfterFind({
        workspaceId: input.claims.workspaceId,
        agentId: input.claims.agentId,
        callControlId: input.claims.callControlId,
        conversationId: input.claims.callControlId,
        requestedDate: findInput.requestedDate,
        offerSetId: findInput.offerSetId,
        slotIds: findInput.slotIds,
      });
      this.invalidateContextCache();
      await this.ensureHydrated();
      this.logStageTransitionIfChanged();
    },

    async afterBookConfirmed() {
      await patchWorkflowAfterBookConfirmed({
        callControlId: input.claims.callControlId,
        conversationId: input.claims.callControlId,
      });
      this.invalidateContextCache();
      await this.ensureHydrated();
      this.logStageTransitionIfChanged();
    },

    isBookingConfirmed() {
      if (this.getStage() === "BOOKING_CONFIRMED") return true;
      const ctx = this.getCallContext();
      return ctx?.bookingWorkflow?.bookingConfirmed === true;
    },

    logStageTransitionIfChanged() {
      const stage = this.getStage();
      if (stage === lastLoggedStage) return;
      const env = this.getWorkflowEnvelope();
      const tools = this.getActiveTools();
      const prev = lastLoggedStage;
      lastLoggedStage = stage;
      const ctx = this.getCallContext();
      console.info(
        `LIVE_RUNTIME_STATE_TRANSITION ${JSON.stringify({
          call_id: input.claims.callId,
          live_session_id: liveSessionId,
          from_stage: prev,
          to_stage: stage,
          allowed_next_actions: env.allowed_next_actions,
          forbidden_actions: env.forbidden_actions,
          active_tool_names: tools.map((t) => t.name),
          offer_set_id: ctx?.currentOfferSet?.offerSetId ?? null,
          booking_continue_required: env.booking_continue_required,
        })}`,
      );
    },
  };

  return plane;
}

/** Merge workflow envelope into parsed tool JSON (Responses backend). */
export function mergeFindArgsWithCallContext(
  args: Record<string, unknown>,
  ctx: VoiceV2CallContext,
): { merged: Record<string, unknown>; mergeNotes: string[] } {
  const merged: Record<string, unknown> = { ...args };
  const notes: string[] = [];
  const wf = workflowFromContext(ctx);
  const requestedDate = String(merged.requested_date || merged.requestedDate || "").trim();
  if (!requestedDate && wf.requestedDate) {
    merged.requested_date = wf.requestedDate;
    notes.push("filled_requested_date_from_call_context");
  }
  return { merged, mergeNotes: notes };
}

export function enrichLiveToolOutputWithControlPlane(
  controlPlane: LiveControlPlane,
  toolOutput: Record<string, unknown>,
): string {
  return JSON.stringify(controlPlane.mergeWorkflowIntoToolOutput(toolOutput));
}
