import { mctbSemanticStructuredJson } from "@/lib/mctb/semantic-llm";
import {
  isBareCarrierStopMessage,
  protocolLeadRecoveryIntent,
} from "@/lib/mctb/lead-recovery/protocol-intent";
import { LEAD_RECOVERY_INTENT_AGENT_SYSTEM } from "@/lib/mctb/lead-recovery/intent-agent-prompt";
import type {
  LeadRecoveryCollectField,
  LeadRecoveryIntent,
  LeadRecoveryUrgency,
  LeadRecoveryWorkflowTarget,
  LeadRecoveryWorkflowUpdate,
  StructuredLeadIntent,
} from "@/lib/mctb/lead-recovery/types";
import { LEAD_RECOVERY_INTENTS } from "@/lib/mctb/lead-recovery/types";
import {
  defaultBookingDispositionForIntent,
  parseBookingDisposition,
} from "@/lib/mctb/lead-recovery/booking-semantics";
import {
  buildMctbSemanticConversationContext,
  leadRecoveryIntentUserPayload,
  type MctbSemanticConversationContext,
} from "@/lib/mctb/semantic-conversation-context";
import {
  INTENT_CONSISTENCY_REPAIR_HINT,
  parseStopScope,
  reconcileIntentWithStructuredState,
  reconcileStructuredIntentConsistency,
  validateStructuredIntentConsistency,
} from "@/lib/mctb/lead-recovery/intent-semantic-consistency";

function emptyIntent(partial: Partial<StructuredLeadIntent>): StructuredLeadIntent {
  return {
    primary_intent: "UNKNOWN",
    secondary_intents: [],
    lead_type: "UNKNOWN",
    urgency: "NORMAL",
    service_category: null,
    reason_for_contact: null,
    location: { raw: null, resolved: null },
    requested_time: null,
    booking_requested: false,
    booking_disposition: "NONE",
    callback_requested: false,
    payment_intent: false,
    complaint: false,
    human_requested: false,
    human_required: false,
    needs_clarification: false,
    extracted_entities: {},
    semantic_missing_information: [],
    language: "en",
    confidence: 0.5,
    missing_required_fields: [],
    workflow_updates: [],
    stop_scope: null,
    ...partial,
  };
}

function isIntent(v: string): v is LeadRecoveryIntent {
  return (LEAD_RECOVERY_INTENTS as readonly string[]).includes(v);
}

const WORKFLOW_TARGETS = new Set<LeadRecoveryWorkflowTarget>([
  "PENDING_PAYMENT",
  "PENDING_BOOKING",
  "PENDING_CALLBACK",
  "ALL_PENDING",
]);

const COLLECT_FIELDS = new Set<LeadRecoveryCollectField>([
  "NAME",
  "EMAIL",
  "PHONE",
  "ADDRESS",
  "REASON",
  "SERVICE_CATEGORY",
  "ISSUE_DESCRIPTION",
  "URGENCY",
  "CALLBACK_NUMBER",
  "CALLBACK_TIME",
  "APPOINTMENT_PREFERENCE",
]);

function parseWorkflowUpdates(raw: unknown): LeadRecoveryWorkflowUpdate[] {
  if (!Array.isArray(raw)) return [];
  const out: LeadRecoveryWorkflowUpdate[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const target = String((row as { target?: string }).target || "");
    const instruction = String((row as { instruction?: string }).instruction || "");
    if (!WORKFLOW_TARGETS.has(target as LeadRecoveryWorkflowTarget)) continue;
    if (instruction !== "CANCEL" && instruction !== "KEEP") continue;
    out.push({
      target: target as LeadRecoveryWorkflowTarget,
      instruction: instruction as "CANCEL" | "KEEP",
    });
  }
  return out;
}

function parseExtractedEntities(raw: unknown): Partial<Record<LeadRecoveryCollectField, string>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<LeadRecoveryCollectField, string>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!COLLECT_FIELDS.has(k as LeadRecoveryCollectField)) continue;
    if (typeof v === "string" && v.trim()) out[k as LeadRecoveryCollectField] = v.trim();
  }
  return out;
}

export function normalizeStructuredIntent(raw: Record<string, unknown>): StructuredLeadIntent | null {
  const primary = String(raw.primary_intent || "UNKNOWN");
  if (!isIntent(primary)) return null;
  const secondary = Array.isArray(raw.secondary_intents)
    ? raw.secondary_intents
        .map((x) => String(x))
        .filter(isIntent)
    : [];
  const confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) return null;
  const urgencyRaw = String(raw.urgency || "NORMAL").toUpperCase();
  const urgency: LeadRecoveryUrgency =
    urgencyRaw === "LOW" || urgencyRaw === "HIGH" || urgencyRaw === "EMERGENCY"
      ? (urgencyRaw as LeadRecoveryUrgency)
      : "NORMAL";
  const loc = raw.location && typeof raw.location === "object" ? (raw.location as Record<string, unknown>) : {};
  const humanRequested =
    raw.human_requested === true || (raw.human_required === true && raw.human_requested !== false);

  const extracted = parseExtractedEntities(raw.extracted_entities);
  if (typeof loc.raw === "string" && loc.raw.trim() && !extracted.ADDRESS) {
    extracted.ADDRESS = loc.raw.trim();
  }

  const semanticMissing = Array.isArray(raw.semantic_missing_information)
    ? raw.semantic_missing_information.map((x) => String(x)).filter(Boolean)
    : [];

  return emptyIntent({
    primary_intent: primary,
    secondary_intents: secondary,
    lead_type:
      raw.lead_type === "NEW" || raw.lead_type === "EXISTING" ? raw.lead_type : "UNKNOWN",
    urgency,
    service_category: typeof raw.service_category === "string" ? raw.service_category : null,
    reason_for_contact: typeof raw.reason_for_contact === "string" ? raw.reason_for_contact : null,
    location: {
      raw: typeof loc.raw === "string" ? loc.raw : null,
      resolved: typeof loc.resolved === "string" ? loc.resolved : null,
    },
    requested_time: typeof raw.requested_time === "string" ? raw.requested_time : null,
    booking_requested: raw.booking_requested === true,
    booking_disposition: parseBookingDisposition(
      raw.booking_disposition ??
        (raw.booking_requested === true ? "REQUEST_BOOKING" : defaultBookingDispositionForIntent(primary)),
    ),
    callback_requested: raw.callback_requested === true,
    payment_intent: raw.payment_intent === true,
    complaint: raw.complaint === true,
    human_requested: humanRequested,
    human_required: false,
    needs_clarification: raw.needs_clarification === true,
    extracted_entities: extracted,
    semantic_missing_information: semanticMissing,
    language: typeof raw.language === "string" ? raw.language : "en",
    confidence: Math.max(0, Math.min(1, confidence)),
    missing_required_fields: [],
    workflow_updates: parseWorkflowUpdates(raw.workflow_updates),
    stop_scope: parseStopScope(raw.stop_scope),
  });
}

function finalizeStructuredIntent(intent: StructuredLeadIntent): StructuredLeadIntent {
  const issues = validateStructuredIntentConsistency(intent);
  if (!issues.length) return intent;
  const reconciled = reconcileStructuredIntentConsistency(intent);
  const after = validateStructuredIntentConsistency(reconciled);
  if (!after.length) return reconciled;
  return {
    ...reconciled,
    needs_clarification: true,
    primary_intent: "UNKNOWN",
    confidence: Math.min(reconciled.confidence, 0.4),
  };
}

function llmUnavailableIntent(): StructuredLeadIntent {
  return emptyIntent({ primary_intent: "UNKNOWN", confidence: 0.15, needs_clarification: true });
}

function shouldDeferBareStopToSemantics(ctx: MctbSemanticConversationContext | null): boolean {
  if (!ctx) return false;
  const st = ctx.structured_state;
  if (st.pending_action) return true;
  if (
    st.active_workflow === "BOOKING" ||
    st.active_workflow === "PAYMENT" ||
    st.active_workflow === "CALLBACK" ||
    st.active_workflow === "MIXED"
  ) {
    return true;
  }
  return ctx.conversation.some((t) => t.role === "business");
}

export async function runLeadRecoveryIntentAgent(input: {
  message: string;
  workspaceId?: string;
  conversationId?: string;
  conversationContext?: MctbSemanticConversationContext | null;
  /** @deprecated use conversationContext */
  sessionPhase?: string | null;
  priorCustomerMessage?: string | null;
  bookingSessionActive?: boolean;
  offeredSlots?: Array<{ slot_id: string; label?: string | null }>;
}): Promise<StructuredLeadIntent> {
  let userPayload: Record<string, unknown>;
  let semanticCtx: MctbSemanticConversationContext | null = input.conversationContext ?? null;
  if (!semanticCtx && input.workspaceId && input.conversationId) {
    semanticCtx = await buildMctbSemanticConversationContext({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      latestCustomerMessage: input.message,
    });
  }

  const deferStop =
    isBareCarrierStopMessage(input.message) && shouldDeferBareStopToSemantics(semanticCtx);
  const protocol = deferStop ? null : protocolLeadRecoveryIntent({ message: input.message });
  if (protocol) {
    return finalizeStructuredIntent(
      reconcileIntentWithStructuredState(protocol, semanticCtx?.structured_state),
    );
  }

  if (input.conversationContext) {
    userPayload = leadRecoveryIntentUserPayload(input.conversationContext);
  } else if (semanticCtx) {
    userPayload = leadRecoveryIntentUserPayload(semanticCtx);
  } else {
    userPayload = {
      message: input.message,
      conversation_context: {
        session_phase: input.sessionPhase,
        prior_customer_message: input.priorCustomerMessage || null,
        booking_session_active: input.bookingSessionActive === true,
        offered_slots: input.offeredSlots || null,
      },
    };
  }

  const invoke = async (repairHint?: string) =>
    mctbSemanticStructuredJson<Record<string, unknown>>({
      system: repairHint
        ? `${LEAD_RECOVERY_INTENT_AGENT_SYSTEM}\n\n${repairHint}`
        : LEAD_RECOVERY_INTENT_AGENT_SYSTEM,
      user: JSON.stringify(userPayload),
      temperature: 0.1,
      maxTokens: 800,
    });

  let llm = await invoke();
  if (!llm) return llmUnavailableIntent();
  let normalized = normalizeStructuredIntent(llm.data);
  if (!normalized) return llmUnavailableIntent();

  if (validateStructuredIntentConsistency(normalized).length > 0) {
    llm = await invoke(INTENT_CONSISTENCY_REPAIR_HINT);
    if (llm) {
      const repaired = normalizeStructuredIntent(llm.data);
      if (repaired) normalized = repaired;
    }
  }

  normalized = reconcileIntentWithStructuredState(
    normalized,
    semanticCtx?.structured_state,
  );

  return finalizeStructuredIntent(normalized);
}
