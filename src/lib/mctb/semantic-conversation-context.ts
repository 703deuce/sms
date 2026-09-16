/**
 * Canonical conversation + structured state for MCTB semantic LLMs.
 */
import { getPrisma } from "@/lib/db";
import { getMctbAiBookingSessionStore } from "@/lib/mctb/ai-booking/session-store";
import { loadLeadRecoveryState } from "@/lib/mctb/lead-recovery/state-store";
import type { LeadRecoveryConversationState } from "@/lib/mctb/lead-recovery/types";
import type { MctbAiBookingSession } from "@/lib/mctb/ai-booking/types";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import {
  applyConversationTruncationPolicy,
  estimateContextTokens,
  type MctbConversationTurn,
} from "@/lib/mctb/conversation-thread";
import { referenceLocalDates } from "@/lib/mctb/ai-booking/local-time-semantics";

export type MctbActiveWorkflow = "NONE" | "BOOKING" | "PAYMENT" | "CALLBACK" | "COLLECT" | "MIXED";

export type MctbStructuredConversationState = {
  active_workflow: MctbActiveWorkflow;
  workflow_stage: string | null;
  session_phase: string | null;
  last_primary_intent: string | null;
  collected_fields: Record<string, string>;
  missing_fields_runtime: string[];
  pending_action: string | null;
  booking_session_active: boolean;
  offered_slots: Array<{ index: number; slot_id: string; label: string | null }>;
  last_queried_window: { startUtc: string; endUtc: string } | null;
  pending_slot_id: string | null;
};

export type MctbSemanticConversationContext = {
  latest_customer_message: string;
  conversation: MctbConversationTurn[];
  structured_state: MctbStructuredConversationState;
  context_message_count: number;
  context_truncated: boolean;
  context_estimated_tokens: number;
  /** @deprecated use conversation — kept for metrics only */
  recent_messages: MctbConversationTurn[];
};

export type MctbConversationContextMetrics = {
  samples: number;
  average_messages: number;
  p95_messages: number;
  average_context_tokens: number;
  p95_context_tokens: number;
  normal_thread_truncation_count: number;
};

const metrics: MctbConversationContextMetrics = {
  samples: 0,
  average_messages: 0,
  p95_messages: 0,
  average_context_tokens: 0,
  p95_context_tokens: 0,
  normal_thread_truncation_count: 0,
};

const messageCountSamples: number[] = [];
const tokenSamples: number[] = [];

export function recordConversationContextMetrics(ctx: MctbSemanticConversationContext): void {
  messageCountSamples.push(ctx.context_message_count);
  tokenSamples.push(ctx.context_estimated_tokens);
  metrics.samples += 1;
  if (ctx.context_truncated && ctx.context_message_count <= 30) {
    metrics.normal_thread_truncation_count += 1;
  }
}

export function getConversationContextMetrics(): MctbConversationContextMetrics {
  const sortedM = [...messageCountSamples].sort((a, b) => a - b);
  const sortedT = [...tokenSamples].sort((a, b) => a - b);
  const p95Idx = (arr: number[]) =>
    arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))] : 0;
  return {
    samples: metrics.samples,
    average_messages: sortedM.length
      ? sortedM.reduce((a, b) => a + b, 0) / sortedM.length
      : 0,
    p95_messages: p95Idx(sortedM),
    average_context_tokens: sortedT.length
      ? sortedT.reduce((a, b) => a + b, 0) / sortedT.length
      : 0,
    p95_context_tokens: p95Idx(sortedT),
    normal_thread_truncation_count: metrics.normal_thread_truncation_count,
  };
}

export function resetConversationContextMetrics(): void {
  messageCountSamples.length = 0;
  tokenSamples.length = 0;
  metrics.samples = 0;
  metrics.normal_thread_truncation_count = 0;
}

function deriveActiveWorkflow(
  state: LeadRecoveryConversationState,
  session: MctbAiBookingSession | null,
): MctbActiveWorkflow {
  if (session?.offeredSlots?.length || state.activeSpecialist === "SCHEDULING") return "BOOKING";
  if (state.pendingAction?.action === "SEND_TEXT_TO_PAY") return "PAYMENT";
  if (state.pendingAction?.action === "CREATE_CALLBACK_REQUEST") return "CALLBACK";
  if (state.phase === "COLLECT" || state.missingFields.length > 0) return "COLLECT";
  return "NONE";
}

function mapDbDirection(direction: string): MctbConversationTurn["role"] {
  const d = direction.toLowerCase();
  if (d === "outbound" || d === "out") return "business";
  return "customer";
}

async function loadInboxConversationThread(conversationId: string): Promise<MctbConversationTurn[]> {
  const prisma = getPrisma();
  if (!prisma.conversationMessage?.findMany) return [];
  try {
    const rows = await prisma.conversationMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: { direction: true, body: true },
      take: 80,
    });
    return rows
      .map((r) => ({
        role: mapDbDirection(r.direction),
        text: r.body.trim(),
      }))
      .filter((t) => t.text.length > 0);
  } catch {
    return [];
  }
}

function resolveRawThread(
  inbox: MctbConversationTurn[],
  stateThread: MctbConversationTurn[],
  latestCustomer: string,
): MctbConversationTurn[] {
  let base = inbox.length >= stateThread.length ? inbox : stateThread;
  if (!base.length) base = [];
  const last = base.at(-1);
  if (!(last?.role === "customer" && last.text === latestCustomer.trim())) {
    base = [...base, { role: "customer", text: latestCustomer.trim() }];
  }
  return base;
}

/** Canonical builder — full conversation + authoritative structured state. */
export const buildMctbConversationContext = buildMctbSemanticConversationContext;

export async function buildMctbSemanticConversationContext(input: {
  workspaceId: string;
  conversationId: string;
  latestCustomerMessage: string;
}): Promise<MctbSemanticConversationContext> {
  const { getVoiceV2SmsContinuation, mergeVoiceContinuationIntoConversationTurns } = await import(
    "@/lib/voice-v2/ai-call-recovery/continuation-hydration"
  );
  const voiceContinuation = getVoiceV2SmsContinuation(input.conversationId);

  const [state, session, inbox] = await Promise.all([
    loadLeadRecoveryState({ workspaceId: input.workspaceId, conversationId: input.conversationId }),
    getMctbAiBookingSessionStore().get(input.conversationId),
    loadInboxConversationThread(input.conversationId),
  ]);

  const collected: Record<string, string> = {};
  for (const [k, v] of Object.entries(state.collectedFields)) {
    if (v != null && String(v).trim()) collected[k] = String(v);
  }
  if (voiceContinuation?.structuredState) {
    Object.assign(collected, voiceContinuation.structuredState.callerFields);
    Object.assign(collected, voiceContinuation.structuredState.customFields);
  }

  const offered = (session?.offeredSlots ?? []).map((s, i) => ({
    index: i + 1,
    slot_id: s.slotId,
    label: s.label ?? null,
  }));

  const structured_state: MctbStructuredConversationState = {
    session_phase: state.phase,
    workflow_stage: session?.stage ?? state.phase,
    active_workflow: deriveActiveWorkflow(state, session),
    last_primary_intent: state.lastIntent?.primary_intent ?? state.currentIntent,
    collected_fields: collected,
    missing_fields_runtime: [...state.missingFields],
    pending_action: state.pendingAction?.action ?? null,
    booking_session_active: Boolean(session?.offeredSlots?.length),
    offered_slots: offered,
    last_queried_window: session?.lastQueriedWindow ?? null,
    pending_slot_id: session?.pendingSlotId ?? null,
  };

  let rawThread = resolveRawThread(
    inbox,
    state.conversationThread ?? [],
    input.latestCustomerMessage,
  );
  if (voiceContinuation?.voiceTranscript?.length) {
    rawThread = mergeVoiceContinuationIntoConversationTurns({
      voiceTurns: voiceContinuation.voiceTranscript,
      smsTurns: rawThread,
    });
  }
  const { conversation, truncated, message_count } = applyConversationTruncationPolicy(rawThread);
  const payloadPreview = JSON.stringify({ conversation, structured_state });
  const context_estimated_tokens = estimateContextTokens(payloadPreview);

  const ctx: MctbSemanticConversationContext = {
    latest_customer_message: input.latestCustomerMessage,
    conversation,
    structured_state,
    context_message_count: message_count,
    context_truncated: truncated,
    context_estimated_tokens,
    recent_messages: conversation,
  };

  recordConversationContextMetrics(ctx);
  return ctx;
}

export function leadRecoveryIntentUserPayload(
  ctx: MctbSemanticConversationContext,
): Record<string, unknown> {
  return {
    conversation: ctx.conversation,
    structured_state: ctx.structured_state,
    latest_customer_message: ctx.latest_customer_message,
    context_precedence_note:
      "Authoritative order: structured_state and provider/runtime results > workspace policy > conversation transcript > model inference. Transcript is context only.",
  };
}

export function bookingRouterUserPayload(
  ctx: MctbSemanticConversationContext,
): Record<string, unknown> {
  return {
    conversation: ctx.conversation,
    structured_state: ctx.structured_state,
    latest_message: ctx.latest_customer_message,
    ai_booking_session_active: ctx.structured_state.booking_session_active,
    session_stage: ctx.structured_state.workflow_stage,
  };
}

export function schedulingSpecialistUserPayloadFromContext(
  ctx: MctbSemanticConversationContext,
  extras: {
    timezone: string;
    nowIso: string;
    bookingAuthorized: boolean;
    business_constraints: Record<string, unknown> | null;
  },
): Record<string, unknown> {
  const ref = referenceLocalDates(extras.nowIso, extras.timezone);
  return {
    conversation: ctx.conversation,
    structured_state: ctx.structured_state,
    latest_message: ctx.latest_customer_message,
    timezone: extras.timezone,
    current_time_utc: extras.nowIso,
    today_local_date: ref.today_local_date,
    tomorrow_local_date: ref.tomorrow_local_date,
    booking_already_authorized: extras.bookingAuthorized,
    business_constraints: extras.business_constraints,
    context_precedence_note:
      "Authoritative order: structured_state and provider results > business_constraints > conversation transcript > your inference. Stale business SMS in the thread must not override current offered_slots or availability.",
  };
}

export async function schedulingSpecialistContextExtras(input: {
  workspaceId: string;
  timezone: string;
}): Promise<{
  bookingConfig: Awaited<ReturnType<typeof loadMctbAiBookingConfig>>;
  nowIso: string;
}> {
  const bookingConfig = await loadMctbAiBookingConfig(input.workspaceId);
  const fixed = process.env.LR_CERT_E2E_NOW?.trim();
  const nowIso = fixed && !Number.isNaN(Date.parse(fixed)) ? fixed : new Date().toISOString();
  return { bookingConfig, nowIso };
}
