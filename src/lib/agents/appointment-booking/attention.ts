/**
 * Operational inbox (Attention) + learning queue — typed, not silent vector memory.
 */

import { getPrisma } from "@/lib/db";
import { loadAppointmentBookingAgent } from "@/lib/agents/appointment-booking/load-agent";
import { listChangeProposals } from "@/lib/agents/appointment-booking/change-proposals";
import { listWorkflowDrafts } from "@/lib/agents/appointment-booking/workflow-architect";
import { buildLiveReadiness } from "@/lib/agents/appointment-booking/readiness";
import { searchAgentActivity } from "@/lib/agents/appointment-booking/execution-trace";
import { parseVoiceAgentConfig } from "@/lib/voice/types";

export type AttentionSeverity = "critical" | "high" | "medium" | "low";

export type AttentionItem = {
  id: string;
  kind:
    | "calendar_reauth"
    | "test_failed"
    | "booking_unconfirmed"
    | "transfer_unavailable"
    | "knowledge_approval"
    | "workflow_draft"
    | "health"
    | "owner_decision"
    | "learning"
    | "exception";
  severity: AttentionSeverity;
  title: string;
  summary: string;
  affectedCallIds?: string[];
  status: "open" | "resolved" | "dismissed";
  recommendedAction: string;
  href?: string;
  askAmyPrompt?: string;
};

export type LearningQueueItem = {
  id: string;
  pattern: string;
  sampleSize: number;
  supportingCallIds: string[];
  currentApprovedInfo: string;
  suggestedAddition: string;
  confidence: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected" | "edited";
  classification:
    | "business_knowledge"
    | "booking_policy"
    | "routing_rule"
    | "workflow_change"
    | "prohibited";
};

export type MemoryClass =
  | "approved_business_fact"
  | "amy_booking_rule"
  | "owner_preference"
  | "known_issue"
  | "recent_change"
  | "rejected_suggestion"
  | "observed_pattern"
  | "pending_learning_item"
  | "temporary_runtime_note";

export type TypedMemoryRecord = {
  id: string;
  class: MemoryClass;
  scope: "workspace" | "agent" | "location" | "version";
  summary: string;
  source: string;
  confidence: "low" | "medium" | "high";
  approvalState: "approved" | "pending" | "rejected" | "n/a";
  createdAt: string;
  updatedAt: string;
  locationId?: string | null;
  agentVersionId?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function buildAttentionInbox(input: {
  workspaceId: string;
  agentId: string;
}): Promise<{ items: AttentionItem[]; openCount: number }> {
  const agent = await loadAppointmentBookingAgent(
    input.workspaceId,
    input.agentId,
  );
  if (!agent) return { items: [], openCount: 0 };

  const items: AttentionItem[] = [];
  const readiness = await buildLiveReadiness({
    workspaceId: input.workspaceId,
    agentStatus: agent.identity.status,
    health: agent.health,
    telnyxAssistantId: agent.telnyxAssistantId,
    phoneNumberE164: agent.phoneNumberE164,
    calendarConnectionIds: agent.calendarConnectionIds,
    primaryFlowId: agent.primaryFlowId,
    currentVersionId: agent.currentVersionId,
  });

  for (const b of readiness.blockers) {
    items.push({
      id: `blocker:${b.code}`,
      kind: b.code.includes("calendar")
        ? "calendar_reauth"
        : b.code.includes("transfer")
          ? "transfer_unavailable"
          : "health",
      severity: b.severity === "critical" ? "critical" : "high",
      title: b.message,
      summary: `${b.affectedFunctionality}. ${b.recommendedAction}`,
      status: "open",
      recommendedAction: b.recommendedAction,
      href: `/agents/${input.agentId}?tab=health`,
      askAmyPrompt: "Why is your health degraded?",
    });
  }

  const pendingFacts = agent.businessBrain.knowledgeFacts.filter((f) =>
    ["pending_review", "extracted", "pending"].includes(
      String(f.status || "").toLowerCase(),
    ),
  );
  if (pendingFacts.length) {
    items.push({
      id: "knowledge:pending",
      kind: "knowledge_approval",
      severity: "medium",
      title: `${pendingFacts.length} website fact(s) awaiting approval`,
      summary: pendingFacts
        .slice(0, 3)
        .map((f) => f.label)
        .join("; "),
      status: "open",
      recommendedAction: "Review and approve or reject in Memory and Knowledge",
      href: `/agents/${input.agentId}?tab=memory`,
      askAmyPrompt: "What website facts need my approval?",
    });
  }

  const prisma = getPrisma();
  const row = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: { draftConfig: true },
  });
  const proposals = listChangeProposals(row?.draftConfig);

  for (const p of proposals) {
    if (String(p.status || "").toLowerCase() === "pending") {
      items.push({
        id: `proposal:${p.id}`,
        kind: "owner_decision",
        severity: "high",
        title: p.summary || "Change proposal awaiting confirmation",
        summary: "Draft changes are ready — confirm to create a version and deploy.",
        status: "open",
        recommendedAction: "Review diff, run tests, then confirm",
        href: `/agents/${input.agentId}?tab=versions`,
        askAmyPrompt: "Explain the pending change proposal",
      });
    }
  }

  const drafts = listWorkflowDrafts(row?.draftConfig);

  for (const d of drafts) {
    items.push({
      id: `draft:${d.id}`,
      kind: "workflow_draft",
      severity: "medium",
      title: `Workflow draft waiting: ${d.name || d.id}`,
      summary: "Validate, test, then activate when ready.",
      status: "open",
      recommendedAction: "Open Workflows tab",
      href: `/agents/${input.agentId}?tab=workflows`,
    });
  }

  const failures = await searchAgentActivity({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    limit: 5,
    failuresOnly: true,
  }).catch(() => []);

  for (const f of failures.slice(0, 3)) {
    items.push({
      id: `fail:${f.callId}`,
      kind: "booking_unconfirmed",
      severity: "high",
      title: "Booking or call failure needs attention",
      summary: f.summary,
      affectedCallIds: [f.callId],
      status: "open",
      recommendedAction: "Inspect timeline and tool result",
      href: `/agents/${input.agentId}?tab=activity`,
      askAmyPrompt: `Why didn’t you book call ${f.callId}?`,
    });
  }

  const learning = await listLearningQueue(input);
  for (const l of learning.items.filter((i) => i.status === "pending").slice(0, 3)) {
    items.push({
      id: `learn:${l.id}`,
      kind: "learning",
      severity: "low",
      title: `Learning suggestion: ${l.pattern}`,
      summary: l.suggestedAddition,
      affectedCallIds: l.supportingCallIds,
      status: "open",
      recommendedAction: "Approve, edit, or reject in Memory",
      href: `/agents/${input.agentId}?tab=memory`,
      askAmyPrompt: "What are you learning from recent calls?",
    });
  }

  return {
    items,
    openCount: items.filter((i) => i.status === "open").length,
  };
}

export async function listLearningQueue(input: {
  workspaceId: string;
  agentId: string;
}): Promise<{ items: LearningQueueItem[] }> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) return { items: [] };
  const config = parseVoiceAgentConfig(agent.draftConfig);
  const op = asRecord(asRecord(config.advanced).agentOperating);
  const raw = Array.isArray(op.learningQueue) ? op.learningQueue : [];
  const items: LearningQueueItem[] = raw.map((row, i) => {
    const r = asRecord(row);
    return {
      id: String(r.id || `learn_${i}`),
      pattern: String(r.pattern || "Observed pattern"),
      sampleSize: Number(r.sampleSize || 0),
      supportingCallIds: Array.isArray(r.supportingCallIds)
        ? (r.supportingCallIds as string[])
        : [],
      currentApprovedInfo: String(r.currentApprovedInfo || "Not in approved knowledge"),
      suggestedAddition: String(r.suggestedAddition || ""),
      confidence:
        r.confidence === "high" || r.confidence === "low"
          ? r.confidence
          : "medium",
      status:
        r.status === "approved" ||
        r.status === "rejected" ||
        r.status === "edited"
          ? r.status
          : "pending",
      classification:
        (r.classification as LearningQueueItem["classification"]) ||
        "business_knowledge",
    };
  });
  return { items };
}

export async function buildTypedMemoryView(input: {
  workspaceId: string;
  agentId: string;
}): Promise<{
  sharedFacts: TypedMemoryRecord[];
  agentFacts: TypedMemoryRecord[];
  learning: LearningQueueItem[];
  rejected: TypedMemoryRecord[];
}> {
  const agent = await loadAppointmentBookingAgent(
    input.workspaceId,
    input.agentId,
  );
  if (!agent) {
    return { sharedFacts: [], agentFacts: [], learning: [], rejected: [] };
  }

  const now = new Date().toISOString();
  const sharedFacts: TypedMemoryRecord[] = agent.businessBrain.knowledgeFacts.map(
    (f, i) => ({
      id: `fact_${i}`,
      class:
        String(f.status || "").toLowerCase() === "rejected"
          ? "rejected_suggestion"
          : "approved_business_fact",
      scope: "workspace",
      summary: `${f.label}: ${f.summary}`,
      source: "business_brain",
      confidence: "high",
      approvalState:
        String(f.status || "").toLowerCase() === "owner_approved" ||
        String(f.status || "").toLowerCase() === "approved"
          ? "approved"
          : String(f.status || "").toLowerCase() === "rejected"
            ? "rejected"
            : "pending",
      createdAt: now,
      updatedAt: now,
    }),
  );

  const agentFacts: TypedMemoryRecord[] = [
    {
      id: "booking_policy",
      class: "amy_booking_rule",
      scope: "agent",
      summary: `Min notice ${agent.bookingPolicy.minimumNoticeMinutes}m · max advance ${agent.bookingPolicy.maximumAdvanceDays}d · same-day cutoff ${agent.bookingPolicy.sameDayCutoff || "none"}`,
      source: "booking_policy",
      confidence: "high",
      approvalState: "approved",
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    },
  ];

  if (agent.profile.transferPolicySummary) {
    agentFacts.push({
      id: "transfer_policy",
      class: "amy_booking_rule",
      scope: "agent",
      summary: agent.profile.transferPolicySummary,
      source: "transfer_policy",
      confidence: "high",
      approvalState: "approved",
      createdAt: agent.updatedAt,
      updatedAt: agent.updatedAt,
    });
  }

  const learning = await listLearningQueue(input);
  const rejected = sharedFacts.filter((f) => f.approvalState === "rejected");

  return {
    sharedFacts: sharedFacts.filter((f) => f.approvalState !== "rejected"),
    agentFacts,
    learning: learning.items,
    rejected,
  };
}

/**
 * Classify a natural-language “teach Amy” instruction.
 */
export function classifyTeachInstruction(text: string): {
  classification: LearningQueueItem["classification"];
  proposalKind: "booking_policy" | "knowledge" | "workflow" | "routing" | "reject";
  summary: string;
} {
  const q = text.toLowerCase();
  if (
    /delete (all )?agents|bypass|ignore (compliance|quiet hours|opt-?out)|hack|shell command/.test(
      q,
    )
  ) {
    return {
      classification: "prohibited",
      proposalKind: "reject",
      summary: "This request is not allowed under platform safety rules.",
    };
  }
  if (
    /transfer|emergency|sewer|route to|send .* to (marcus|human|staff)/.test(q)
  ) {
    return {
      classification: "routing_rule",
      proposalKind: "routing",
      summary: "Treat as a routing / emergency transfer rule.",
    };
  }
  if (
    /workflow|after hours version|send a booking link|offer three|if a caller does not book/.test(
      q,
    )
  ) {
    return {
      classification: "workflow_change",
      proposalKind: "workflow",
      summary: "Treat as a workflow draft change.",
    };
  }
  if (
    /same-?day|minimum notice|require (a )?service address|cancel|reschedule|cutoff|duration|confirmation/.test(
      q,
    )
  ) {
    return {
      classification: "booking_policy",
      proposalKind: "booking_policy",
      summary: "Treat as a booking-policy change proposal.",
    };
  }
  return {
    classification: "business_knowledge",
    proposalKind: "knowledge",
    summary: "Treat as business knowledge / FAQ pending approval.",
  };
}
