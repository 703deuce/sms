import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { defaultVoiceV2BookingWorkflow } from "@/lib/voice-v2/booking-workflow";
import { applyCallerMeaningToCallContext } from "@/lib/voice-v2/caller-meaning-apply";
import type { CallerMeaning, CallerMeaningFacts } from "@/lib/voice-v2/caller-meaning";
import type { VoiceDialogGoal } from "@/lib/voice-v2/dialog-goal";
import { dialogFromContext } from "@/lib/voice-v2/dialog-goal";
import { persistCallContext } from "@/lib/voice-v2/dialog-manager";
import { workflowFromContext } from "@/lib/voice-v2/booking-workflow";
import { buildVoiceV2ControlPlaneEnvelope } from "@/lib/voice-v2/control-plane-envelope";
import { effectiveRequestedDate } from "@/lib/voice-v2/scheduling-preference-state";
import { clearVoiceV2CallSessions, setVoiceV2CallContext } from "@/lib/voice-v2/intake/session-store";
import type { VoiceV2CallContext } from "@/lib/voice-v2/intake/types";
import type { VoiceV2TestExecutors } from "./executor-overrides";
import {
  clearAllVoiceV2TestExecutors,
  setVoiceV2TestExecutorsForCall,
} from "./executor-overrides";
import {
  clearVoiceV2OfferSetTestStore,
  seedVoiceV2OfferSetForTest,
  type StoredVoiceV2OfferSet,
} from "@/lib/voice-v2/offer-set-store";
import { createLiveControlPlane } from "@/lib/voice/telnyx/openai-live-bridge/live-control-plane";
import { createLiveToolDispatchContextFromClaims } from "@/lib/voice/telnyx/openai-live-bridge/live-tool-runtime";
import { runLiveControlPlaneTurn } from "@/lib/voice/telnyx/openai-live-bridge/live-control-plane-turn";
import type { RealtimeBridgeStreamClaims } from "@/lib/voice/telnyx/openai-realtime-bridge/stream-token";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";
import { resetAllUtteranceRevisionGuards } from "@/lib/voice/telnyx/openai-live-bridge/live-utterance-revision-guard";

export const ORCHESTRATION_TEST_CONFIG = {
  advanced: {
    appointmentReceptionistWizard: {
      bookingStrategy: "MICROSOFT_365",
      knowledgeItems: [],
    },
  },
} as VoiceAgentConfig;

export const ORCHESTRATION_INTAKE_SCHEMA: VoiceV2CallContext["intakeSchema"] = {
  fields: [
    {
      key: "name",
      enabled: true,
      requirementLevel: "REQUIRED_BEFORE_BOOKING",
      label: "Name",
      questionText: "May I have your name?",
      valueType: "text",
    },
    {
      key: "email",
      enabled: true,
      requirementLevel: "REQUIRED_BEFORE_BOOKING",
      label: "Email",
      questionText: "What is your email?",
      valueType: "email",
    },
  ],
};

export type HarnessSnapshot = {
  call_id: string;
  workflow_cycle_id: string | null;
  stage: string;
  required_action: string | null;
  scheduling_generation: number;
  offer_set_id: string | null;
  selected_slot_id: string | null;
  requested_date: string | null;
  booking_confirmed: boolean;
  active_goal: VoiceDialogGoal;
  dispatch_counts: { find: number; book: number };
};

export type HarnessTraceLine = {
  step: number;
  kind: string;
  detail: string;
  snapshot: HarnessSnapshot;
};

function defaultFakeFindResult(offerSetId = "offer_test_001") {
  return {
    status: "AVAILABILITY_FOUND",
    voice_v2_status: "AVAILABILITY_FOUND",
    offer_set_id: offerSetId,
    slots: [
      {
        slot_id: "slot_0900",
        start: "2026-09-25T09:00:00-04:00",
        spoken_label: "9 AM",
        label: "9 AM",
      },
      {
        slot_id: "slot_1000",
        start: "2026-09-25T10:00:00-04:00",
        spoken_label: "10 AM",
        label: "10 AM",
      },
    ],
    timing_ms: {},
  };
}

function defaultFakeBookResult(slotId: string) {
  return {
    status: "BOOKING_CONFIRMED",
    voice_v2_status: "BOOKING_CONFIRMED",
    slot_id: slotId,
    provider_event_id: "test_graph_event_001",
  };
}

export function buildCallerMeaning(input: {
  active_goal?: VoiceDialogGoal;
  facts?: Partial<CallerMeaningFacts>;
  literal_intake_fields?: Partial<Record<string, string>>;
  evidence?: string;
  ambiguities?: string[];
}): CallerMeaning {
  return {
    active_goal: input.active_goal ?? "BOOK_APPOINTMENT",
    facts: {
      requested_date: input.facts?.requested_date ?? null,
      requested_daypart: input.facts?.requested_daypart ?? null,
      requested_time: input.facts?.requested_time ?? null,
      selected_slot_spoken_label: input.facts?.selected_slot_spoken_label ?? null,
      selected_slot_ordinal: input.facts?.selected_slot_ordinal ?? null,
      selected_slot_id: input.facts?.selected_slot_id ?? null,
    },
    corrections: [],
    explicit_action_requests: input.active_goal ? [input.active_goal ?? "BOOK_APPOINTMENT"] : [],
    ambiguities: input.ambiguities ?? [],
    confidence: 0.95,
    digression: false,
    evidence: input.evidence ?? "test utterance",
    literal_intake_fields: input.literal_intake_fields,
  };
}

export class VoiceV2OrchestrationHarness {
  readonly callId: string;
  readonly callControlId: string;
  readonly dispatch: ReturnType<typeof createLiveToolDispatchContextFromClaims>;
  readonly controlPlane: ReturnType<typeof createLiveControlPlane>;
  private stepN = 0;
  readonly trace: HarnessTraceLine[] = [];
  private findCount = 0;
  private bookCount = 0;
  private utteranceSeq = 0;

  constructor(input: {
    callId: string;
    callControlId?: string;
    executors?: VoiceV2TestExecutors;
    initialContext?: Partial<VoiceV2CallContext>;
  }) {
    process.env.VOICE_V2_TEST_EXECUTORS = process.env.VOICE_V2_TEST_EXECUTORS || "fake";
    this.callId = input.callId.startsWith("v3:") ? input.callId : `v3:orch_${input.callId}`;
    this.callControlId = input.callControlId ?? `cc_${input.callId}`;
    const sessionKey = `cc:${this.callControlId}`;

    const ctx: VoiceV2CallContext = {
      sessionKey,
      workspaceId: "ws_test",
      agentId: "agent_test",
      businessTimezone: "America/New_York",
      intakeSchema: ORCHESTRATION_INTAKE_SCHEMA,
      intakeState: {},
      askedFields: {},
      compiledAt: new Date().toISOString(),
      capabilities: {
        voiceV2PstnLiveBooking: true,
        bookingStrategy: "MICROSOFT_365",
      },
      bookingWorkflow: defaultVoiceV2BookingWorkflow(),
      ...input.initialContext,
    };
    setVoiceV2CallContext(ctx);

    const claims: RealtimeBridgeStreamClaims = {
      workspaceId: "ws_test",
      agentId: "agent_test",
      callId: this.callId,
      callControlId: this.callControlId,
    };
    this.controlPlane = createLiveControlPlane({
      claims,
      initialConfig: ORCHESTRATION_TEST_CONFIG,
    });
    this.dispatch = createLiveToolDispatchContextFromClaims(
      claims,
      ORCHESTRATION_TEST_CONFIG,
      { controlPlane: this.controlPlane },
    );
    this.dispatch.testExecutors = input.executors ?? this.buildDefaultExecutors();
    setVoiceV2TestExecutorsForCall(this.callId, this.dispatch.testExecutors);
    this.controlPlane.setLiveSessionId(`live_test_${this.callId}`);
  }

  private buildDefaultExecutors(): VoiceV2TestExecutors {
    return {
      findAvailability: async () => {
        this.findCount += 1;
        const result = defaultFakeFindResult();
        this.seedOfferSet(String(result.offer_set_id), result.slots);
        return result;
      },
      bookOfferedSlot: async ({ args }) => {
        this.bookCount += 1;
        const slotId = String(args.selected_slot_id || args.slot_id || "slot_1000");
        return defaultFakeBookResult(slotId);
      },
    };
  }

  seedOfferSet(offerSetId: string, slots = defaultFakeFindResult(offerSetId).slots) {
    const offer: StoredVoiceV2OfferSet = {
      offerSetId,
      workspaceId: "ws_test",
      voiceCallId: this.callId,
      slots: slots.map((s) => ({
        slot_id: s.slot_id,
        label: s.label ?? s.spoken_label ?? s.slot_id,
        spoken_label: s.spoken_label ?? s.label,
        start_utc: s.start ?? "2026-09-25T13:00:00.000Z",
        end_utc: s.start ?? "2026-09-25T13:30:00.000Z",
      })),
      serviceName: "Test Service",
      timezone: "America/New_York",
      connectionId: null,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    };
    seedVoiceV2OfferSetForTest(offer);
  }

  snapshot(): HarnessSnapshot {
    const ctx = this.controlPlane.getCallContext();
    const env = this.controlPlane.getWorkflowEnvelope();
    const wf = ctx ? workflowFromContext(ctx) : defaultVoiceV2BookingWorkflow();
    return {
      call_id: this.callId,
      workflow_cycle_id: (env.workflow_cycle_id as string) ?? null,
      stage: this.controlPlane.getStage(),
      required_action: (env.required_action as string) ?? null,
      scheduling_generation: this.dispatch.schedulingGeneration,
      offer_set_id: ctx?.currentOfferSet?.offerSetId ?? null,
      selected_slot_id: ctx?.bookingState?.selectedSlotId ?? null,
      requested_date: ctx ? effectiveRequestedDate(ctx) : wf.requestedDate,
      booking_confirmed: this.controlPlane.isBookingConfirmed(),
      active_goal: ctx ? dialogFromContext(ctx).activeGoal : "UNKNOWN",
      dispatch_counts: { find: this.findCount, book: this.bookCount },
    };
  }

  private log(kind: string, detail: string) {
    this.stepN += 1;
    const line: HarnessTraceLine = {
      step: this.stepN,
      kind,
      detail,
      snapshot: this.snapshot(),
    };
    this.trace.push(line);
    const s = line.snapshot;
    console.info(
      `${this.callId} ${String(this.stepN).padStart(2, "0")} ${kind.padEnd(14)} ${detail} | stage=${s.stage} required=${s.required_action ?? "null"} gen=${s.scheduling_generation} offer=${s.offer_set_id ?? "-"} slot=${s.selected_slot_id ?? "-"}`,
    );
  }

  async mergeMeaning(
    meaning: CallerMeaning,
    opts?: {
      mergePolicy?: "full" | "literal_facts_only" | "none";
      skipControlPlaneTurn?: boolean;
    },
  ) {
    await this.controlPlane.ensureHydrated();
    const ctx = this.controlPlane.getCallContext();
    if (!ctx) throw new Error("harness: missing call context");
    const policy = opts?.mergePolicy ?? "full";
    this.utteranceSeq += 1;
    const applied = await applyCallerMeaningToCallContext(ctx, meaning, policy, {
      turnId: `utt_${this.callId}_${this.utteranceSeq}`,
    });
    persistCallContext(applied.ctx);
    this.controlPlane.invalidateContextCache();
    const stageBefore = this.controlPlane.getStage();
    if (!opts?.skipControlPlaneTurn) {
      await this.runTurn("caller_meaning_merge");
    }
    const stageAfter = this.controlPlane.getStage();
    this.log(
      "MERGE",
      `${stageBefore} -> ${stageAfter} goal=${applied.resultingActiveGoal}`,
    );
    return applied;
  }

  async runTurn(reason: string) {
    const findBefore = this.findCount;
    const bookBefore = this.bookCount;
    const requiredBefore = this.snapshot().required_action;
    await runLiveControlPlaneTurn({
      controlPlane: this.controlPlane,
      dispatchContext: this.dispatch,
      autoDispatch: true,
      reason,
    });
    if (requiredBefore === VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE || this.findCount > findBefore) {
      this.log("AUTO_DISPATCH", VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE);
    }
    if (requiredBefore === VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE || this.bookCount > bookBefore) {
      this.log("AUTO_DISPATCH", VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE);
    }
    if (this.findCount > findBefore) {
      this.log("TOOL_RESULT", "AVAILABILITY_FOUND");
      const offerId = this.snapshot().offer_set_id;
      if (offerId) this.seedOfferSet(offerId);
    }
    if (this.bookCount > bookBefore) {
      this.log("TOOL_RESULT", "BOOKING_CONFIRMED");
    }
  }

  assertStage(expected: string, message?: string) {
    const actual = this.controlPlane.getStage();
    if (actual !== expected) {
      throw new Error(
        message ??
          `Expected stage ${expected}, got ${actual}. Snapshot: ${JSON.stringify(this.snapshot())}`,
      );
    }
  }

  assertRequiredAction(expected: string | null) {
    const actual = this.snapshot().required_action;
    if (actual !== expected) {
      throw new Error(`Expected required_action ${expected}, got ${actual}`);
    }
  }

  dispose() {
    setVoiceV2TestExecutorsForCall(this.callId, null);
  }
}

export function resetOrchestrationTestWorld() {
  clearVoiceV2CallSessions();
  clearAllVoiceV2TestExecutors();
  clearVoiceV2OfferSetTestStore();
  resetAllUtteranceRevisionGuards();
}

export function envelopeForContext(ctx: VoiceV2CallContext) {
  return buildVoiceV2ControlPlaneEnvelope(ctx, true, "MICROSOFT_365");
}
