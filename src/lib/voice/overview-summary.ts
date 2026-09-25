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
import { buildCallHandlingBehaviorSummary } from "@/lib/voice/call-handling/behavior-summary";
import { loadReceptionistAnalyticsSnapshot } from "@/lib/voice/analytics/receptionist-analytics-snapshot";
import { resolveCanonicalVoiceV3WorkspaceAgent } from "@/lib/voice-v3/canonical-workspace-agent";
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
  publicationStatusLabel,
  type OverviewAttentionRow,
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

export type VoiceOverviewOperational = {
  publicationStatus: OverviewPublicationStatus;
  publicationLabel: string;
  receptionistName: string | null;
  voiceLabel: string | null;
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
): Promise<VoiceOverviewSummaryResult> {
  const errors: VoiceOverviewSummaryResult["errors"] = {};
  const agent = await resolveCanonicalVoiceV3WorkspaceAgent(workspaceId);

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

  let metrics: VoiceOverviewMetrics | null = null;
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

  let recentCalls: VoiceOverviewRecentCall[] = [];
  try {
    recentCalls = await loadRecentInboundCalls(workspaceId, 5);
  } catch {
    errors.recentCalls = "unavailable";
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
  agent: Awaited<ReturnType<typeof resolveCanonicalVoiceV3WorkspaceAgent>>;
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

  return {
    publicationStatus: input.publicationStatus,
    publicationLabel: publicationStatusLabel(input.publicationStatus),
    receptionistName: input.receptionistName,
    voiceLabel: input.voiceLabel,
    phone,
    calendar,
    businessKnowledge,
    businessHours,
    manageReceptionistHref: "/voice/receptionist",
  };
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
