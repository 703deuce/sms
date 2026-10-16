import "server-only";

import { getPrisma } from "@/lib/db";
import { assessAiReceptionistCallHandlingReadiness } from "@/lib/call-handling/readiness";
import {
  hasExplicitCallHandlingSelection,
  readCallHandlingBlock,
} from "@/lib/call-handling/phone-settings";
import {
  loadCanonicalVoiceIngressPhone,
  resolveCanonicalVoiceIngressPhoneNumberId,
} from "@/lib/call-handling/resolve-canonical-voice-ingress";
import { countVoiceCallsNeedingAttention } from "@/lib/platform/voice-attention-count";
import { getWizardActivationIssues } from "@/lib/solutions/appointment-receptionist/capability-checklist";
import { resolveLiveCalendar } from "@/lib/solutions/appointment-receptionist/live-calendar";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { wizardBookingRequiresCalendarConnection } from "@/lib/solutions/appointment-receptionist/wizard-readiness";
import {
  ANSWER_WHEN_OPTIONS,
  CAPABILITY_OPTIONS,
} from "@/lib/solutions/appointment-receptionist/defaults";
import { readTelephonyProvisionFromSettings } from "@/lib/voice-v3/receptionist-livekit-policy";
import { buildCallHandlingBehaviorSummary } from "@/lib/voice/call-handling/behavior-summary";
import { loadReceptionistAnalyticsSnapshot } from "@/lib/voice/analytics/receptionist-analytics-snapshot";
import type { CanonicalVoiceV3WorkspaceAgent } from "@/lib/voice-v3/canonical-workspace-agent";
import { loadWizardFromAgent } from "@/lib/voice/runtime/load-wizard";
import { DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG } from "@/lib/voice-receptionist-wizard/operating-maturity/defaults";
import {
  operatingStateLabel,
  resolveVoiceV2OperatingState,
} from "@/lib/voice-receptionist-wizard/operating-maturity/operating-state";
import {
  buildOverviewAttentionRows,
  calendarProviderCustomerLabel,
  deriveOverviewPublicationStatus,
  deriveOverviewLiveSyncStatus,
  liveSyncStatusLabel,
  publicationStatusLabel,
  type OverviewAttentionRow,
  type OverviewLiveSyncStatus,
  type OverviewPublicationStatus,
} from "./overview-summary-present";

export type VoiceOverviewRecentCall = {
  id: string;
  fromE164: string;
  contactName: string | null;
  startedAt: string;
  durationSeconds: number | null;
  outcome: string | null;
  appointmentBooked: boolean;
  transferred: boolean;
  voicemailDetected: boolean;
  leadScore: number | null;
  status: string;
  transfers: Array<{ status: string | null; answered: boolean | null }>;
};

export type VoiceOverviewCapabilityRow = {
  id: string;
  label: string;
  detail: string;
  enabled: boolean;
};

export type VoiceOverviewOperational = {
  agentId: string | null;
  publicationStatus: OverviewPublicationStatus;
  publicationLabel: string;
  receptionistName: string | null;
  voiceLabel: string | null;
  openingGreeting: string | null;
  assignedPhoneE164: string | null;
  answerWhenLabel: string | null;
  capabilities: VoiceOverviewCapabilityRow[];
  transferSummary: string | null;
  callbackSummary: string | null;
  livekitStatus: {
    label: string;
    tone: "ok" | "warn" | "muted";
  } | null;
  liveSyncStatus: OverviewLiveSyncStatus;
  liveSyncLabel: string;
  healthMessage: string | null;
  setupProblems: string[];
  phone: {
    label: string;
    tone: "ok" | "warn" | "muted";
  } | null;
  calendar: {
    label: string;
    tone: "ok" | "warn";
    href: string;
  } | null;
  businessKnowledge: {
    label: string;
    openGaps: number;
    failedSources: number;
  } | null;
  businessHours: {
    label: string;
    href: string;
  } | null;
  manageReceptionistHref: string;
};

export type VoiceOverviewMetrics = {
  periodLabel: string;
  totalCalls: number;
  appointmentsBooked: number;
  callbacksRequested: number;
};

export type VoiceOverviewDependencies = {
  businessKnowledge: {
    detail: string;
    href: string;
  } | null;
  callHandling: {
    detail: string;
    href: string;
  } | null;
};

export type VoiceOverviewSummary = {
  mode: "first_run" | "active";
  operational: VoiceOverviewOperational | null;
  attention: OverviewAttentionRow[];
  metrics: VoiceOverviewMetrics | null;
  recentCalls: VoiceOverviewRecentCall[];
  dependencies: VoiceOverviewDependencies;
};

export type VoiceOverviewSummaryResult = {
  data: VoiceOverviewSummary;
  errors: {
    metrics?: string;
    recentCalls?: string;
    knowledge?: string;
    calendar?: string;
    attention?: string;
  };
};

const CALENDAR_HREF = "/integrations";

export async function loadVoiceOverviewSummary(
  workspaceId: string,
  options?: { hubOnly?: boolean },
): Promise<VoiceOverviewSummaryResult> {
  const hubOnly = options?.hubOnly === true;
  const errors: VoiceOverviewSummaryResult["errors"] = {};
  const { resolveWorkspaceAppointmentReceptionistAgent } = await import(
    "@/lib/solutions/appointment-receptionist/resolve-workspace-agent"
  );
  const agent = await resolveWorkspaceAppointmentReceptionistAgent(workspaceId);

  if (!agent) {
    return {
      data: {
        mode: "first_run",
        operational: null,
        attention: [],
        metrics: null,
        recentCalls: [],
        dependencies: { businessKnowledge: null, callHandling: null },
      },
      errors,
    };
  }

  const publicationStatus = deriveOverviewPublicationStatus({
    hasCanonicalAgent: true,
    published: agent.published,
    agentStatus: agent.status,
  });

  let wizard: AppointmentReceptionistWizardState | null = null;
  try {
    wizard = await loadWizardFromAgent(workspaceId, agent.agentId);
  } catch {
    wizard = null;
  }

  const receptionistName =
    wizard?.agentName?.trim() || agent.agentName?.trim() || null;
  const voiceLabel = wizard?.voiceLabel?.trim() || null;

  const operational = await buildOperationalState({
    workspaceId,
    agent,
    wizard,
    publicationStatus,
    receptionistName,
    voiceLabel,
    errors,
  });

  let attention: OverviewAttentionRow[] = [];
  let metrics: VoiceOverviewMetrics | null = null;
  let recentCalls: VoiceOverviewRecentCall[] = [];

  if (!hubOnly) {
    try {
      const [voiceCallAttention, openGaps, failedSources] = await Promise.all([
        countVoiceCallsNeedingAttention(workspaceId),
        countOpenKnowledgeGaps(workspaceId),
        countFailedKnowledgeSources(workspaceId),
      ]);

      const blocking =
        wizard
          ? getWizardActivationIssues(wizard, {
              hasCalendarConnection: operational.calendar?.tone === "ok",
            }).filter((i) => i.severity === "blocking")
          : [];

      attention = buildOverviewAttentionRows({
        voiceCallsNeedingAttention: voiceCallAttention,
        openKnowledgeGaps: openGaps,
        blockingSetupIssues: publicationStatus === "active" ? [] : blocking,
      });
    } catch {
      errors.attention = "unavailable";
    }

    try {
      const snap = await loadReceptionistAnalyticsSnapshot(workspaceId, 7);
      metrics = {
        periodLabel: "Last 7 days",
        totalCalls: snap.totalCalls,
        appointmentsBooked: snap.appointmentsBooked,
        callbacksRequested: snap.callbacksRequested,
      };
    } catch {
      errors.metrics = "unavailable";
    }

    try {
      recentCalls = await loadRecentInboundCalls(workspaceId, 5);
    } catch {
      errors.recentCalls = "unavailable";
    }
  }

  const dependencies = buildDependencies({
    wizard,
    operational,
    openGaps: operational.businessKnowledge?.openGaps ?? 0,
    failedSources: operational.businessKnowledge?.failedSources ?? 0,
  });

  return {
    data: {
      mode: "active",
      operational,
      attention,
      metrics,
      recentCalls,
      dependencies,
    },
    errors,
  };
}

async function buildOperationalState(input: {
  workspaceId: string;
  agent: CanonicalVoiceV3WorkspaceAgent;
  wizard: AppointmentReceptionistWizardState | null;
  publicationStatus: OverviewPublicationStatus;
  receptionistName: string | null;
  voiceLabel: string | null;
  errors: VoiceOverviewSummaryResult["errors"];
}): Promise<VoiceOverviewOperational> {
  const phone = await resolvePhoneStatus(input.workspaceId, input.agent!.agentId);
  let calendar: VoiceOverviewOperational["calendar"] = null;
  try {
    calendar = await resolveCalendarStatus(input.workspaceId, input.wizard);
  } catch {
    input.errors.calendar = "unavailable";
  }

  let openGaps = 0;
  let failedSources = 0;
  try {
    openGaps = await countOpenKnowledgeGaps(input.workspaceId);
    failedSources = await countFailedKnowledgeSources(input.workspaceId);
  } catch {
    input.errors.knowledge = "unavailable";
  }

  const businessKnowledge = input.errors.knowledge
    ? null
    : {
        label:
          openGaps > 0 || failedSources > 0
            ? formatKnowledgeLabel(openGaps, failedSources)
            : "Ready",
        openGaps,
        failedSources,
      };

  const businessHours = resolveBusinessHoursSummary(input.wizard);

  const agentId = input.agent?.agentId ?? null;
  const editBase = agentId
    ? `/voice/receptionist/edit?agentId=${encodeURIComponent(agentId)}`
    : "/voice/receptionist/edit";

  const enabledCaps = new Set(input.wizard?.capabilities || []);
  const capabilities: VoiceOverviewCapabilityRow[] = CAPABILITY_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.title,
    detail: opt.description,
    enabled: enabledCaps.has(opt.id),
  }));

  const answerWhenLabel =
    ANSWER_WHEN_OPTIONS.find((o) => o.id === input.wizard?.answerWhen)?.label ?? null;

  const assignedPhoneE164 = input.wizard?.phoneNumberE164?.trim() || null;

  const callHandlingSummary = input.wizard
    ? buildCallHandlingBehaviorSummary(input.wizard)
    : null;
  const transferSummary =
    callHandlingSummary?.transfersEnabled && callHandlingSummary.primaryDestinationLabel
      ? `Transfers to ${callHandlingSummary.primaryDestinationLabel}`
      : callHandlingSummary
        ? "Transfers off"
        : null;
  const callbackSummary = input.wizard?.callbackRequestsEnabled
    ? "Callback requests enabled"
    : null;

  const livekitStatus = await resolveLiveKitStatusForAgent({
    workspaceId: input.workspaceId,
    agentId,
    phoneNumberId: input.agent?.primaryPhoneNumberId ?? null,
    wizardPhoneNumberId: input.wizard?.phoneNumberId ?? null,
  });

  let healthStatus: string | null = null;
  let healthMessage: string | null = null;
  if (agentId) {
    const healthRow = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: input.workspaceId },
      select: { healthStatus: true, healthMessage: true, status: true },
    });
    healthStatus = healthRow?.healthStatus ?? null;
    healthMessage = healthRow?.healthMessage ?? null;
  }

  const liveSyncStatus = deriveOverviewLiveSyncStatus({
    publicationStatus: input.publicationStatus,
    agentStatus: input.agent?.status ?? null,
    hasPhone: Boolean(input.wizard?.phoneNumberId || input.agent?.primaryPhoneNumberId),
    healthStatus,
    healthMessage,
    livekitTone: livekitStatus.tone,
  });
  const liveSyncLabel = liveSyncStatusLabel(liveSyncStatus);

  const setupProblems: string[] = [];
  if (livekitStatus.tone !== "ok") {
    setupProblems.push(livekitStatus.label);
  }
  if (phone?.tone === "warn") {
    setupProblems.push(phone.label);
  }
  if (input.publicationStatus !== "active") {
    setupProblems.push(publicationStatusLabel(input.publicationStatus));
  }
  if (liveSyncStatus === "pending_live_sync") {
    setupProblems.push(
      healthMessage || "Saved changes are not yet applied to live calls.",
    );
  }

  return {
    agentId,
    publicationStatus: input.publicationStatus,
    publicationLabel: publicationStatusLabel(input.publicationStatus),
    receptionistName: input.receptionistName,
    voiceLabel: input.voiceLabel,
    openingGreeting: input.wizard?.openingGreeting?.trim() || null,
    assignedPhoneE164,
    answerWhenLabel,
    capabilities,
    transferSummary,
    callbackSummary,
    livekitStatus,
    liveSyncStatus,
    liveSyncLabel,
    healthMessage,
    setupProblems,
    phone,
    calendar,
    businessKnowledge,
    businessHours,
    manageReceptionistHref: editBase,
  };
}

async function resolveLiveKitStatusForAgent(input: {
  workspaceId: string;
  agentId: string | null;
  phoneNumberId: string | null;
  wizardPhoneNumberId: string | null;
}): Promise<{ label: string; tone: "ok" | "warn" | "muted" }> {
  const prisma = getPrisma();
  const phoneId = input.wizardPhoneNumberId || input.phoneNumberId;
  if (!phoneId) {
    return { label: "No phone number assigned", tone: "warn" };
  }
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneId, workspaceId: input.workspaceId },
    select: { settingsJson: true, e164: true },
  });
  if (!phone?.e164) {
    return { label: "Assigned phone not found", tone: "warn" };
  }
  const stored = readTelephonyProvisionFromSettings(phone.settingsJson);
  if (stored.lastError) {
    return { label: `LiveKit: ${stored.lastError}`, tone: "warn" };
  }
  try {
    const { verifyNumberRouting } = await import("@/lib/telephony/provisioning");
    const verify = await verifyNumberRouting({
      workspaceId: input.workspaceId,
      phoneNumberId: phoneId,
    });
    if (verify.ok && stored.routingMode === "livekit_sip" && stored.state === "active") {
      return { label: "LiveKit SIP ingress verified", tone: "ok" };
    }
    if (verify.issues.length) {
      return {
        label: `LiveKit needs attention (${verify.issues.slice(0, 2).join(", ")})`,
        tone: "warn",
      };
    }
    return { label: "LiveKit provisioning incomplete", tone: "warn" };
  } catch {
    return { label: "Could not verify LiveKit routing", tone: "muted" };
  }
}

async function resolvePhoneStatus(
  workspaceId: string,
  agentId: string,
): Promise<VoiceOverviewOperational["phone"]> {
  const ingressId = await resolveCanonicalVoiceIngressPhoneNumberId({ workspaceId });
  const ingress = ingressId
    ? await loadCanonicalVoiceIngressPhone({ workspaceId, voiceIngressPhoneNumberId: ingressId })
    : null;

  if (!ingress) {
    return { label: "Phone setup needs attention", tone: "warn" };
  }

  const block = readCallHandlingBlock(ingress.settingsJson);
  if (block.activeCallHandler === "mctb" && hasExplicitCallHandlingSelection(ingress.settingsJson)) {
    return {
      label: "Missed Call Text Back is currently selected for call handling",
      tone: "muted",
    };
  }

  if (block.activeCallHandler === "ai_receptionist" || !hasExplicitCallHandlingSelection(ingress.settingsJson)) {
    const readiness = await assessAiReceptionistCallHandlingReadiness({
      workspaceId,
      preferredAgentId: agentId,
    });
    if (readiness.ready) {
      return { label: "Ready", tone: "ok" };
    }
    return {
      label: readiness.message || "Phone setup needs attention",
      tone: "warn",
    };
  }

  return { label: "Phone setup needs attention", tone: "warn" };
}

async function resolveCalendarStatus(
  workspaceId: string,
  wizard: AppointmentReceptionistWizardState | null,
): Promise<VoiceOverviewOperational["calendar"] | null> {
  if (!wizard || !wizardBookingRequiresCalendarConnection(wizard)) {
    return null;
  }

  const prisma = getPrisma();
  const [voiceCalendars, integrationConnections] = await Promise.all([
    prisma.voiceCalendarConnection.findMany({
      where: { workspaceId },
      select: { id: true, name: true, provider: true, status: true },
    }),
    prisma.integrationConnection.findMany({
      where: { workspaceId },
      select: { provider: true, status: true, config: true },
    }),
  ]);

  const live = resolveLiveCalendar({ voiceCalendars, integrationConnections });
  if (live.connected) {
    const label =
      calendarProviderCustomerLabel(live.provider) || "Calendar connected";
    return { label, tone: "ok", href: CALENDAR_HREF };
  }

  return {
    label: "Calendar connection needs attention",
    tone: "warn",
    href: CALENDAR_HREF,
  };
}

function resolveBusinessHoursSummary(
  wizard: AppointmentReceptionistWizardState | null,
): VoiceOverviewOperational["businessHours"] | null {
  const schedule =
    wizard?.operatingMaturity?.businessSchedule ??
    DEFAULT_VOICE_V2_OPERATING_MATURITY_CONFIG.businessSchedule;
  if (!schedule?.weekly) return null;

  const resolved = resolveVoiceV2OperatingState({ schedule });
  const label = operatingStateLabel(resolved.state);
  return {
    label: label === "Open" ? "Open now" : label,
    href: "/voice/knowledge#hours",
  };
}

function formatKnowledgeLabel(openGaps: number, failedSources: number): string {
  const parts: string[] = [];
  if (openGaps > 0) {
    parts.push(
      `${openGaps} unanswered question${openGaps === 1 ? "" : "s"}`,
    );
  }
  if (failedSources > 0) {
    parts.push(
      `${failedSources} source${failedSources === 1 ? "" : "s"} need attention`,
    );
  }
  return parts.join(" · ");
}

function buildDependencies(input: {
  wizard: AppointmentReceptionistWizardState | null;
  operational: VoiceOverviewOperational;
  openGaps: number;
  failedSources: number;
}): VoiceOverviewDependencies {
  const bkDetail =
    input.openGaps > 0 || input.failedSources > 0
      ? formatKnowledgeLabel(input.openGaps, input.failedSources)
      : "Ready";

  const businessKnowledge =
    input.operational.businessKnowledge || input.openGaps > 0 || input.failedSources > 0
      ? { detail: bkDetail, href: "/voice/knowledge" }
      : null;

  let callHandling: VoiceOverviewDependencies["callHandling"] = null;
  if (input.wizard) {
    const summary = buildCallHandlingBehaviorSummary(input.wizard);
    let detail = "Configured";
    if (summary.transfersEnabled && summary.primaryDestinationLabel) {
      detail = `Calls transfer to ${summary.primaryDestinationLabel} when needed`;
    } else if (!summary.transfersEnabled) {
      detail = "Transfers off";
    }
    callHandling = { detail, href: "/voice/call-handling" };
  }

  return { businessKnowledge, callHandling };
}

async function countOpenKnowledgeGaps(workspaceId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.voiceKnowledgeGap.count({
    where: { workspaceId, status: "OPEN" },
  });
}

async function countFailedKnowledgeSources(workspaceId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.voiceKnowledgeSource.count({
    where: { workspaceId, status: "failed" },
  });
}

async function loadRecentInboundCalls(
  workspaceId: string,
  limit: number,
): Promise<VoiceOverviewRecentCall[]> {
  const prisma = getPrisma();
  const rows = await prisma.voiceCall.findMany({
    where: {
      workspaceId,
      isTest: false,
      direction: "INBOUND",
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      fromE164: true,
      startedAt: true,
      durationSeconds: true,
      outcome: true,
      appointmentBooked: true,
      transferred: true,
      voicemailDetected: true,
      leadScore: true,
      status: true,
      contactId: true,
      transfers: {
        select: { status: true, answered: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });

  const contactIds = rows
    .map((r) => r.contactId)
    .filter((id): id is string => Boolean(id));
  const contacts =
    contactIds.length > 0
      ? await prisma.contact.findMany({
          where: { workspaceId, id: { in: contactIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return rows.map((c) => {
    const contact = c.contactId ? contactMap.get(c.contactId) : null;
    const name = contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim()
      : "";
    return {
      id: c.id,
      fromE164: c.fromE164,
      contactName: name || null,
      startedAt: c.startedAt.toISOString(),
      durationSeconds: c.durationSeconds,
      outcome: c.outcome,
      appointmentBooked: c.appointmentBooked,
      transferred: c.transferred,
      voicemailDetected: c.voicemailDetected,
      leadScore: c.leadScore,
      status: c.status,
      transfers: c.transfers,
    };
  });
}
