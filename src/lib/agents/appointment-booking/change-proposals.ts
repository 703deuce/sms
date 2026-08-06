/**
 * Change proposals for Appointment Booking Agent.
 * Owner chat may create drafts; production mutation requires confirm:true.
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "@/lib/voice/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";
import { extractBookingPolicyFromConfig } from "@/lib/agents/appointment-booking/profile";
import type { BookingPolicy } from "@/lib/agents/appointment-booking/types";

export type ChangeDiff = {
  path: string;
  before: unknown;
  after: unknown;
};

export type AgentChangeProposal = {
  id: string;
  agentId: string;
  type: "update_booking_policy" | "update_identity" | "custom";
  summary: string;
  changes: ChangeDiff[];
  riskLevel: "read" | "low" | "medium" | "high";
  requiresConfirmation: true;
  status: "pending" | "applied" | "rejected" | "cancelled";
  createdAt: string;
  createdByUserId?: string;
  appliedAt?: string;
  appliedVersionHint?: string;
  affectedAgents: string[];
  testsRequired: string[];
  rollbackPlan: string;
  patch: {
    bookingPolicy?: Partial<BookingPolicy>;
    identity?: { name?: string; displayName?: string; description?: string };
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function operatingState(config: VoiceAgentConfig) {
  const advanced = asRecord(config.advanced);
  return asRecord(advanced.agentOperating);
}

function withOperatingState(
  config: VoiceAgentConfig,
  operating: Record<string, unknown>,
): VoiceAgentConfig {
  return {
    ...config,
    advanced: {
      ...(asRecord(config.advanced) || {}),
      agentOperating: operating,
    },
  };
}

export function listChangeProposals(draftConfig: unknown): AgentChangeProposal[] {
  const config = parseVoiceAgentConfig(draftConfig || {});
  const op = operatingState(config);
  const list = Array.isArray(op.changeProposals) ? op.changeProposals : [];
  return list.map((p) => p as AgentChangeProposal);
}

export async function persistChangeProposals(
  workspaceId: string,
  agentId: string,
  proposals: AgentChangeProposal[],
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const config = parseVoiceAgentConfig(agent.draftConfig);
  const op = operatingState(config);
  const next = withOperatingState(config, {
    ...op,
    changeProposals: proposals,
  });
  await updateVoiceAgentDraft(workspaceId, agentId, { draftConfig: next });
  return proposals;
}

export function buildBookingPolicyProposal(input: {
  agentId: string;
  current: BookingPolicy;
  patch: Partial<BookingPolicy>;
  summary?: string;
  userId?: string;
}): AgentChangeProposal {
  const changes: ChangeDiff[] = [];
  for (const [key, after] of Object.entries(input.patch)) {
    if (after === undefined) continue;
    const before = (input.current as Record<string, unknown>)[key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    changes.push({ path: `bookingPolicy.${key}`, before, after });
  }
  if (!changes.length) {
    throw new Error("No booking policy changes detected");
  }

  const riskLevel: AgentChangeProposal["riskLevel"] =
    "canCancel" in input.patch || "canBook" in input.patch
      ? "high"
      : "minimumNoticeMinutes" in input.patch ||
          "sameDayCutoff" in input.patch ||
          "maximumAdvanceDays" in input.patch
        ? "medium"
        : "low";

  return {
    id: createId(),
    agentId: input.agentId,
    type: "update_booking_policy",
    summary:
      input.summary ||
      changes.map((c) => `${c.path}: ${String(c.before)} → ${String(c.after)}`).join("; "),
    changes,
    riskLevel,
    requiresConfirmation: true,
    status: "pending",
    createdAt: new Date().toISOString(),
    createdByUserId: input.userId,
    affectedAgents: [input.agentId],
    testsRequired: [
      "new_caller_books",
      "tomorrow_at_five",
      "slot_unavailable",
      "hold_then_book",
    ],
    rollbackPlan:
      "Reject this proposal, or activate a prior VoiceAgentVersion via rollback_agent_version.",
    patch: { bookingPolicy: input.patch },
  };
}

/** Parse common owner phrases into a booking-policy patch. */
export function parseBookingPolicyRequest(
  question: string,
): Partial<BookingPolicy> | null {
  const q = question.toLowerCase();
  const patch: Partial<BookingPolicy> = {};

  const noticeHours = q.match(
    /(?:minimum notice|min(?:imum)? notice|same[- ]day|notice)\s*(?:from\s+\d+\s*(?:hours?|minutes?)?\s*)?(?:to\s+)?(\d+)\s*hours?/,
  );
  const noticeMins = q.match(
    /(?:minimum notice|min(?:imum)? notice|notice)\s*(?:to\s+)?(\d+)\s*min/,
  );
  if (noticeHours) patch.minimumNoticeMinutes = Number(noticeHours[1]) * 60;
  else if (noticeMins) patch.minimumNoticeMinutes = Number(noticeMins[1]);
  else if (/four hours|4 hours/.test(q) && /notice/.test(q)) {
    patch.minimumNoticeMinutes = 240;
  } else if (/two hours|2 hours/.test(q) && /notice/.test(q)) {
    patch.minimumNoticeMinutes = 120;
  }

  const cutoff = q.match(
    /(?:after|before|cutoff|stop booking(?:\s+same[- ]day)?(?:\s+appointments?)?(?:\s+after)?)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
  );
  if (cutoff && /same[- ]day|after\s+\d|stop booking/.test(q)) {
    let hour = Number(cutoff[1]);
    const minute = cutoff[2] ? Number(cutoff[2]) : 0;
    const meridiem = (cutoff[3] || "").toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    patch.sameDayCutoff = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  if (/require (an )?address|address before/.test(q)) {
    patch.requireServiceAddress = true;
  }
  if (/do not (require )?address|don't require address/.test(q)) {
    patch.requireServiceAddress = false;
  }
  if (/disable cancel|cannot cancel|don't allow cancel|do not cancel/.test(q)) {
    patch.canCancel = false;
  }
  if (/allow cancel|enable cancel/.test(q)) {
    patch.canCancel = true;
  }
  if (/disable reschedule|cannot reschedule/.test(q)) {
    patch.canReschedule = false;
  }
  if (/allow reschedule|enable reschedule/.test(q)) {
    patch.canReschedule = true;
  }
  if (/turn off (confirmation )?sms|disable (confirmation )?sms/.test(q)) {
    patch.sendSmsConfirmation = false;
  }
  if (/send (confirmation )?sms|enable (confirmation )?sms/.test(q)) {
    patch.sendSmsConfirmation = true;
  }

  return Object.keys(patch).length ? patch : null;
}

function applyBookingPolicyToConfig(
  config: VoiceAgentConfig,
  patch: Partial<BookingPolicy>,
): VoiceAgentConfig {
  const sections = [...(config.conversationFlow?.sections || [])];
  const idx = sections.findIndex((s) => s.type === "booking" || s.id === "booking");
  const existing = idx >= 0 ? sections[idx] : null;
  const cfg = asRecord(existing?.config);
  const types = Array.isArray(cfg.appointmentTypes)
    ? cfg.appointmentTypes.map((t) => asRecord(t))
    : [];
  const behavior = {
    ...asRecord(cfg.bookingBehavior),
    ...(patch.minimumNoticeMinutes != null
      ? { minimumNoticeMinutes: patch.minimumNoticeMinutes }
      : {}),
    ...(patch.maximumAdvanceDays != null
      ? { maximumAdvanceDays: patch.maximumAdvanceDays }
      : {}),
    ...(patch.requireFinalConfirmation != null
      ? { requireFinalConfirmation: patch.requireFinalConfirmation }
      : {}),
    ...(patch.sameDayCutoff !== undefined
      ? { sameDayCutoff: patch.sameDayCutoff }
      : {}),
    ...(patch.bookingMode ? { bookingMode: patch.bookingMode } : {}),
  };

  const nextTypes = types.map((t) => {
    const next = { ...t };
    if (patch.appointmentDurationMinutes != null) {
      next.durationMin = patch.appointmentDurationMinutes;
    }
    if (patch.minimumNoticeMinutes != null) {
      const hours = patch.minimumNoticeMinutes / 60;
      next.minNotice =
        hours >= 1 && patch.minimumNoticeMinutes % 60 === 0
          ? `${hours} hours`
          : `${patch.minimumNoticeMinutes} minutes`;
    }
    if (patch.maximumAdvanceDays != null) {
      next.maxDaysAhead = `${patch.maximumAdvanceDays} days`;
    }
    if (patch.requireServiceAddress != null) {
      const required = Array.isArray(next.requiredFields)
        ? next.requiredFields.map(String)
        : ["full_name", "phone", "service"];
      const hasAddress = required.some((f) => /address/i.test(f));
      if (patch.requireServiceAddress && !hasAddress) required.push("service_address");
      if (!patch.requireServiceAddress) {
        next.requiredFields = required.filter((f) => !/address/i.test(f));
      } else {
        next.requiredFields = required;
      }
    }
    return next;
  });

  const bookingSection = {
    id: "booking",
    type: "booking",
    label: existing?.label || "Book appointment",
    enabled: patch.canBook === false ? false : existing?.enabled !== false,
    config: {
      ...cfg,
      appointmentTypes: nextTypes.length ? nextTypes : cfg.appointmentTypes,
      bookingBehavior: behavior,
      collectFields: {
        ...asRecord(cfg.collectFields),
        ...(patch.requireCallerName != null ? { name: patch.requireCallerName } : {}),
        ...(patch.requirePhoneNumber != null ? { phone: patch.requirePhoneNumber } : {}),
        ...(patch.requireEmail != null ? { email: patch.requireEmail } : {}),
        ...(patch.requireServiceAddress != null
          ? { serviceAddress: patch.requireServiceAddress, address: patch.requireServiceAddress }
          : {}),
      },
    },
  };

  if (idx >= 0) sections[idx] = bookingSection;
  else sections.push(bookingSection);

  let tools = Array.isArray(config.enabledBuiltinTools)
    ? [...config.enabledBuiltinTools]
    : [];
  const ensure = (tool: string, on: boolean) => {
    if (on && !tools.includes(tool)) tools.push(tool);
    if (!on) tools = tools.filter((t) => t !== tool);
  };
  if (patch.canBook != null) {
    ensure("book_appointment", patch.canBook);
    ensure("calendar_availability", patch.canBook);
    ensure("resolve_datetime", patch.canBook);
    ensure("hold_appointment_slot", patch.canBook);
    ensure("release_appointment_hold", patch.canBook);
  }
  if (patch.canReschedule != null) ensure("reschedule_appointment", patch.canReschedule);
  if (patch.canCancel != null) ensure("cancel_appointment", patch.canCancel);
  if (patch.sendSmsConfirmation != null) ensure("send_sms", patch.sendSmsConfirmation);

  return {
    ...config,
    conversationFlow: { sections },
    enabledBuiltinTools: tools,
    messaging: {
      ...(config.messaging || {}),
      ...(patch.sendSmsConfirmation != null
        ? { smsConfirmations: patch.sendSmsConfirmation }
        : {}),
      ...(patch.sendEmailConfirmation != null
        ? { emailConfirmations: patch.sendEmailConfirmation }
        : {}),
    },
  };
}

export async function createChangeProposal(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  patch?: Partial<BookingPolicy>;
  summary?: string;
  naturalLanguage?: string;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const current = extractBookingPolicyFromConfig(agent.draftConfig);
  const patch =
    input.patch ||
    (input.naturalLanguage
      ? parseBookingPolicyRequest(input.naturalLanguage)
      : null);
  if (!patch) throw new Error("Could not understand a booking-policy change");

  const proposal = buildBookingPolicyProposal({
    agentId: input.agentId,
    current,
    patch,
    summary: input.summary,
    userId: input.userId,
  });
  const existing = listChangeProposals(agent.draftConfig).filter(
    (p) => p.status === "pending",
  );
  await persistChangeProposals(input.workspaceId, input.agentId, [
    ...existing,
    proposal,
  ]);
  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.change_proposal_created",
      detail: `agent=${input.agentId} proposal=${proposal.id} ${proposal.summary}`,
    },
  });
  return proposal;
}

export async function confirmChangeProposal(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  proposalId: string;
  confirm: boolean;
  publish?: boolean;
}) {
  if (!input.confirm) {
    throw new Error("confirm:true is required to apply a change proposal");
  }
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const proposals = listChangeProposals(agent.draftConfig);
  const proposal = proposals.find((p) => p.id === input.proposalId);
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "pending") {
    throw new Error(`Proposal is ${proposal.status}`);
  }

  let config = parseVoiceAgentConfig(agent.draftConfig);
  if (proposal.patch.bookingPolicy) {
    config = applyBookingPolicyToConfig(config, proposal.patch.bookingPolicy);
  }
  if (proposal.patch.identity?.name || proposal.patch.identity?.displayName) {
    // identity applied via updateVoiceAgentDraft fields below
  }

  proposal.status = "applied";
  proposal.appliedAt = new Date().toISOString();
  const op = operatingState(config);
  config = withOperatingState(config, {
    ...op,
    changeProposals: proposals.map((p) =>
      p.id === proposal.id ? proposal : p,
    ),
  });

  await updateVoiceAgentDraft(input.workspaceId, input.agentId, {
    draftConfig: config,
    ...(proposal.patch.identity?.name
      ? { name: proposal.patch.identity.name }
      : {}),
    ...(proposal.patch.identity?.displayName
      ? { displayName: proposal.patch.identity.displayName }
      : {}),
    ...(proposal.patch.identity?.description
      ? { description: proposal.patch.identity.description }
      : {}),
  });

  // Always snapshot a draft AgentVersion so apply is auditable even without publish.
  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId: input.agentId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;
  const versionRow = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      version: nextVersion,
      config: config as object,
      changeLog: `proposal:${proposal.id} ${proposal.summary}`.slice(0, 500),
      publishedBy: input.userId,
      testStatus: "ready_for_test",
      deploymentStatus: "draft",
      isMain: false,
    },
  });
  proposal.appliedVersionHint = versionRow.id;

  if (proposal.patch.bookingPolicy) {
    const { syncBookingPolicyToVoiceServices } = await import(
      "@/lib/agents/appointment-booking/sync-policy"
    );
    await syncBookingPolicyToVoiceServices({
      workspaceId: input.workspaceId,
      policy: proposal.patch.bookingPolicy,
      serviceNames: proposal.patch.bookingPolicy.allowedServices,
    });
  }

  // Re-persist proposal with appliedVersionHint
  await persistChangeProposals(
    input.workspaceId,
    input.agentId,
    listChangeProposals(
      (
        await prisma.voiceAgent.findFirst({
          where: { id: input.agentId },
        })
      )?.draftConfig,
    ).map((p) => (p.id === proposal.id ? proposal : p)),
  );

  let published = null;
  if (input.publish) {
    const { publishVoiceAgent } = await import("@/lib/voice/agent-service");
    published = await publishVoiceAgent(
      input.workspaceId,
      input.agentId,
      `proposal:${proposal.id}`,
    );
  }

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.change_proposal_applied",
      detail: `agent=${input.agentId} proposal=${proposal.id} publish=${Boolean(input.publish)}`,
    },
  });

  return {
    proposal,
    published: Boolean(published),
    bookingPolicy: extractBookingPolicyFromConfig(config),
  };
}

export async function rejectChangeProposal(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  proposalId: string;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const proposals = listChangeProposals(agent.draftConfig);
  const proposal = proposals.find((p) => p.id === input.proposalId);
  if (!proposal) throw new Error("Proposal not found");
  proposal.status = "rejected";
  await persistChangeProposals(input.workspaceId, input.agentId, proposals);
  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.change_proposal_rejected",
      detail: `agent=${input.agentId} proposal=${proposal.id}`,
    },
  });
  return { proposal };
}
