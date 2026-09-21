/**
 * Durable SolutionSetup linking for the AI Receptionist / booking agent wizard.
 * Voice conversation graph stays on VoiceAgent; this creates the inventory record
 * My Agents / catalog use — same pattern as Missed Call Text Back.
 */

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { emitPlatformEvent } from "@/lib/platform/events";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { agentTypeFromOutcomeSlug } from "@/lib/agents/types";
import { uniqueAgentDisplayName } from "@/lib/solutions/appointment-receptionist/wizard-presets";

export const SOLUTION_TYPE_CANONICAL = "appointment-receptionist" as const;

/** Map wizard answerWhen / preset → outcome registry slug for labeling & hrefs. */
export function outcomeSlugFromWizard(
  state: Pick<AppointmentReceptionistWizardState, "answerWhen" | "capabilities"> & {
    outcomeSlug?: string | null;
    preset?: string | null;
  },
): string {
  if (state.outcomeSlug) return state.outcomeSlug;
  const preset = state.preset || null;
  if (preset === "every_call") return "answer-every-call";
  if (preset === "nobody_answers") return "missed-overflow";
  if (preset === "after_hours") return "after-hours";
  if (preset === "lead_capture") return "lead-capture";
  if (preset === "service_intake") return "service-intake";

  const when = state.answerWhen;
  if (when === "nobody_answers" || when === "line_busy") return "missed-overflow";
  if (when === "after_hours" || when === "custom_schedule") return "after-hours";

  // Default Book Appointments wizard (no preset) uses every_call + booking.
  if (state.capabilities?.includes("book_appointments")) {
    return "appointment-booking";
  }
  if (
    state.capabilities?.includes("qualify_callers") &&
    !state.capabilities?.includes("book_appointments")
  ) {
    return "lead-capture";
  }
  if (when === "every_call") return "answer-every-call";
  return "appointment-booking";
}

export function setupHrefForOutcome(
  outcomeSlug: string,
  setupId: string,
  agentId?: string | null,
): string {
  const params = new URLSearchParams();
  params.set("setupId", setupId);
  if (agentId) params.set("agentId", agentId);

  const presetBySlug: Record<string, string> = {
    "answer-every-call": "every_call",
    "missed-overflow": "nobody_answers",
    "after-hours": "after_hours",
    "lead-capture": "lead_capture",
    "service-intake": "service_intake",
  };
  const preset = presetBySlug[outcomeSlug];
  if (preset) params.set("preset", preset);

  return `/solutions/ai-call-handling/appointment-assistant/setup?${params.toString()}`;
}

export type UpsertAppointmentReceptionistSetupInput = {
  workspaceId: string;
  agentId: string;
  state: AppointmentReceptionistWizardState & {
    setupId?: string | null;
    outcomeSlug?: string | null;
    preset?: string | null;
  };
  published: boolean;
  links?: {
    calendarConnectionId?: string | null;
    routingRuleIds?: string[];
  };
};

export type UpsertAppointmentReceptionistSetupResult = {
  setupId: string;
  agentId: string;
  outcomeSlug: string;
  created: boolean;
  primaryFlowId?: string | null;
  workflowCompileError?: string | null;
};

function isUniqueViolation(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code || "")
      : "";
  return code === "P2002" || /duplicate|unique/i.test(message);
}

/**
 * Idempotent: one SolutionSetup per VoiceAgent (externalKey = agentId).
 * Also stamps VoiceAgent.sourceSolutionSetupId + linked* fields.
 */
export async function upsertAppointmentReceptionistSetup(
  input: UpsertAppointmentReceptionistSetupInput,
): Promise<UpsertAppointmentReceptionistSetupResult> {
  if (input.published) {
    const { validateVoiceV3WizardPublishQuality, hasBlockingVoiceV3PublishQualityIssues } =
      await import("@/lib/voice-v3/config/validate-publish-quality");
    const qualityIssues = validateVoiceV3WizardPublishQuality(input.state);
    if (hasBlockingVoiceV3PublishQualityIssues(qualityIssues)) {
      const err = new Error(qualityIssues.map((i) => i.message).join(" "));
      (err as Error & { issues: typeof qualityIssues }).issues = qualityIssues;
      throw err;
    }
  }

  const prisma = getPrisma();
  const now = new Date().toISOString();
  const outcomeSlug = outcomeSlugFromWizard(input.state);
  const status = input.published ? "ACTIVE" : "DRAFT";
  const externalKey = input.agentId;

  let existing =
    (input.state.setupId
      ? await prisma.solutionSetup.findFirst({
          where: {
            id: input.state.setupId,
            workspaceId: input.workspaceId,
          },
        })
      : null) ||
    (await prisma.solutionSetup.findFirst({
      where: {
        workspaceId: input.workspaceId,
        solutionType: SOLUTION_TYPE_CANONICAL,
        externalKey,
      },
    }));

  // Prefer agent.sourceSolutionSetupId when present.
  const agentRow = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
    select: {
      sourceSolutionSetupId: true,
      linkedAutomationIds: true,
      linkedCalendarIds: true,
      linkedPhoneNumberIds: true,
      postCallAutomationId: true,
      fallbackAutomationId: true,
    },
  });
  if (!existing && agentRow?.sourceSolutionSetupId) {
    existing = await prisma.solutionSetup.findFirst({
      where: {
        id: agentRow.sourceSolutionSetupId,
        workspaceId: input.workspaceId,
      },
    });
  }

  const rawName =
    (input.state.solutionName || "AI Receptionist").trim() || "AI Receptionist";
  // New setups get a unique stamp so Automations / My Agents are distinguishable.
  const name = existing ? rawName : uniqueAgentDisplayName(rawName);

  const routingRuleIds =
    input.links?.routingRuleIds ||
    (
      await prisma.voiceRoutingRule.findMany({
        where: { workspaceId: input.workspaceId, agentId: input.agentId },
        select: { id: true },
        take: 20,
      })
    ).map((r: { id: string }) => r.id);

  const linkedPhoneNumberIds = input.state.phoneNumberId
    ? [input.state.phoneNumberId]
    : [];
  const linkedCalendarIds = input.links?.calendarConnectionId
    ? [input.links.calendarConnectionId]
    : (agentRow?.linkedCalendarIds as string[] | undefined) || [];

  const configJson = {
    outcomeSlug,
    agentType: agentTypeFromOutcomeSlug(outcomeSlug),
    preset: input.state.preset || null,
    answerWhen: input.state.answerWhen,
    capabilities: input.state.capabilities,
    agentId: input.agentId,
    // Full wizard snapshot so reload does not depend only on VoiceAgent.draftConfig.
    wizard: {
      ...input.state,
      solutionName: name,
      agentId: input.agentId,
    },
  } as unknown as Prisma.InputJsonValue;

  let created = false;
  let setupId = existing?.id as string | undefined;

  if (!setupId) {
    created = true;
    setupId = createId();
    try {
      await prisma.solutionSetup.create({
        data: {
          id: setupId,
          workspaceId: input.workspaceId,
          solutionType: SOLUTION_TYPE_CANONICAL,
          name,
          status,
          configJson,
          linkedAgentIds: [input.agentId],
          linkedAutomationIds: agentRow?.linkedAutomationIds || [],
          linkedPhoneNumberIds,
          linkedCalendarIds,
          linkedRoutingRuleIds: routingRuleIds,
          externalKey,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const raced = await prisma.solutionSetup.findFirst({
        where: {
          workspaceId: input.workspaceId,
          solutionType: SOLUTION_TYPE_CANONICAL,
          externalKey,
        },
      });
      if (!raced) throw err;
      setupId = raced.id;
      created = false;
    }
  }

  await prisma.solutionSetup.update({
    where: { id: setupId },
    data: {
      name,
      status,
      configJson,
      linkedAgentIds: [input.agentId],
      linkedPhoneNumberIds,
      linkedCalendarIds,
      linkedRoutingRuleIds: routingRuleIds,
      externalKey,
      updatedAt: now,
    },
  });

  await prisma.voiceAgent.update({
    where: { id: input.agentId },
    data: {
      name,
      displayName: input.state.agentName || name,
      sourceSolutionSetupId: setupId,
      linkedPhoneNumberIds,
      linkedCalendarIds,
      // Explicit product type — never infer menu placement from capabilities.
      agentType: agentTypeFromOutcomeSlug(outcomeSlug),
      purpose: "appointment_receptionist",
      updatedAt: now,
    },
  });

  // Voice agents: Inbound Call → Run Voice Agent → Call Outcome → End.
  // Activate publishes Telnyx routing from the trigger — not Use Agent → self.
  let primaryFlowId: string | null = null;
  let workflowCompileError: string | null = null;
  try {
    const {
      ensureAgentPrimaryWorkflow,
      triggerBlockFromAnswerWhen,
      routingModeFromAnswerWhen,
    } = await import("@/lib/agents/compile-workflow");
    const agentRow = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId },
      select: {
        primaryFlowId: true,
        linkedAutomationIds: true,
        phoneNumberId: true,
        telnyxAssistantId: true,
      },
    });
    const setupRow = await prisma.solutionSetup.findFirst({
      where: { id: setupId },
      select: { primaryFlowId: true, linkedAutomationIds: true },
    });
    const existingFlowId =
      setupRow?.primaryFlowId ||
      agentRow?.primaryFlowId ||
      setupRow?.linkedAutomationIds?.[0] ||
      agentRow?.linkedAutomationIds?.[0] ||
      null;
    const phoneNumberId =
      input.state.phoneNumberId ||
      agentRow?.phoneNumberId ||
      linkedPhoneNumberIds[0] ||
      null;
    const bookingCaps = new Set(input.state.capabilities || []);
    const includeBooking =
      bookingCaps.has("book_appointments") ||
      bookingCaps.has("reschedule") ||
      bookingCaps.has("cancel") ||
      outcomeSlug === "appointment-booking";
    const includeSms =
      includeBooking &&
      (bookingCaps.has("send_sms_confirmations") ||
        Boolean(input.state.bookingBehavior?.sendSmsAfterBooking));
    const routingMode = routingModeFromAnswerWhen(input.state.answerWhen);
    const compiled = await ensureAgentPrimaryWorkflow({
      workspaceId: input.workspaceId,
      agentName: name,
      outcomeSlug,
      existingFlowId,
      agentId: input.agentId,
      setupId,
      triggerBlock: triggerBlockFromAnswerWhen(input.state.answerWhen),
      routingMode,
      schedule:
        routingMode === "after_hours" ? "after_hours" : "always",
      phoneNumberId,
      phoneNumberE164: input.state.phoneNumberE164 || null,
      ringSeconds: input.state.ringTeamSeconds || 20,
      includeBookingBranches: includeBooking,
      includeSmsConfirmation: includeSms,
      telnyxAssistantId: agentRow?.telnyxAssistantId || null,
      purpose: name,
      activate: false,
      description: phoneNumberId
        ? `Generated from ${name}`
        : `Generated from ${name} — Phone number required`,
    });
    primaryFlowId = compiled.flowId;
  } catch (err) {
    workflowCompileError =
      err instanceof Error ? err.message : String(err);
    primaryFlowId = null;
  }

  await emitPlatformEvent({
    workspaceId: input.workspaceId,
    type: created ? "SOLUTION_SETUP_CREATED" : "SOLUTION_SETUP_UPDATED",
    solutionSetupId: setupId!,
    agentId: input.agentId,
    automationId: primaryFlowId || undefined,
    payload: {
      solutionType: SOLUTION_TYPE_CANONICAL,
      outcomeSlug,
      name,
      published: input.published,
      primaryFlowId,
      workflowCompileError,
    },
    idempotencyKey: `ar-setup:${setupId}:${status}:${Date.now()}`,
  }).catch(() => undefined);

  return {
    setupId: setupId!,
    agentId: input.agentId,
    outcomeSlug,
    created,
    primaryFlowId,
    workflowCompileError,
  };
}

export async function loadAppointmentReceptionistSetup(
  workspaceId: string,
  opts?: { setupId?: string; agentId?: string },
): Promise<{
  setupId: string | null;
  agentId: string | null;
  outcomeSlug: string;
  status: string;
  state: Partial<AppointmentReceptionistWizardState> | null;
} | null> {
  const prisma = getPrisma();

  let setup = opts?.setupId
    ? await prisma.solutionSetup.findFirst({
        where: { id: opts.setupId, workspaceId },
      })
    : null;

  if (!setup && opts?.agentId) {
    setup = await prisma.solutionSetup.findFirst({
      where: {
        workspaceId,
        solutionType: SOLUTION_TYPE_CANONICAL,
        externalKey: opts.agentId,
      },
    });
    if (!setup) {
      const agentLink = await prisma.voiceAgent.findFirst({
        where: { id: opts.agentId, workspaceId },
        select: { sourceSolutionSetupId: true },
      });
      if (agentLink?.sourceSolutionSetupId) {
        setup = await prisma.solutionSetup.findFirst({
          where: { id: agentLink.sourceSolutionSetupId, workspaceId },
        });
      }
    }
  }

  const agentId =
    opts?.agentId ||
    (setup?.linkedAgentIds as string[] | undefined)?.[0] ||
    null;

  const agent = agentId
    ? await prisma.voiceAgent.findFirst({
        where: { id: agentId, workspaceId, archivedAt: null },
      })
    : null;

  if (!setup && !agent) {
    return {
      setupId: null,
      agentId: null,
      outcomeSlug: "appointment-booking",
      status: "DRAFT",
      state: null,
    };
  }

  const draft = (agent?.draftConfig || {}) as Record<string, unknown>;
  const advanced = (draft.advanced || {}) as Record<string, unknown>;
  const wizardSnap =
    (advanced.appointmentReceptionistWizard as Record<string, unknown> | undefined) ||
    {};
  const stored = (setup?.configJson || {}) as Record<string, unknown>;
  const storedWizard = (stored.wizard || {}) as Record<string, unknown>;

  const outcomeSlug =
    (typeof stored.outcomeSlug === "string" && stored.outcomeSlug) ||
    outcomeSlugFromWizard({
      answerWhen: String(
        wizardSnap.answerWhen || storedWizard.answerWhen || "every_call",
      ) as AppointmentReceptionistWizardState["answerWhen"],
      capabilities: (wizardSnap.capabilities ||
        storedWizard.capabilities ||
        []) as AppointmentReceptionistWizardState["capabilities"],
    });

  const state: Partial<AppointmentReceptionistWizardState> = {
    agentId: agent?.id,
    solutionName:
      setup?.name ||
      agent?.displayName ||
      agent?.name ||
      String(wizardSnap.solutionName || storedWizard.solutionName || "AI Receptionist"),
    agentName:
      String(wizardSnap.agentName || storedWizard.agentName || agent?.displayName || "") ||
      undefined,
    phoneNumberId:
      (agent?.phoneNumberId as string | null) ||
      (typeof wizardSnap.phoneNumberId === "string"
        ? wizardSnap.phoneNumberId
        : typeof storedWizard.phoneNumberId === "string"
          ? storedWizard.phoneNumberId
          : null),
    answerWhen: (wizardSnap.answerWhen ||
      storedWizard.answerWhen ||
      "every_call") as AppointmentReceptionistWizardState["answerWhen"],
    capabilities: (wizardSnap.capabilities ||
      storedWizard.capabilities || [
        "answer_questions",
        "book_appointments",
      ]) as AppointmentReceptionistWizardState["capabilities"],
    ringBehavior: (wizardSnap.ringBehavior ||
      storedWizard.ringBehavior ||
      "ai_immediate") as AppointmentReceptionistWizardState["ringBehavior"],
    // Prefer draftConfig snapshot; fall back to durable setup.wizard (full form).
    ...storedWizard,
    ...wizardSnap,
  };

  return {
    setupId: setup?.id || agent?.sourceSolutionSetupId || null,
    agentId: agent?.id || null,
    outcomeSlug,
    status: agent?.status || setup?.status || "DRAFT",
    state,
  };
}
