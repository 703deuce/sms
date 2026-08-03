/**
 * Promote appointment / receptionist agents whose activation was scheduled
 * and whose scheduledAt is now in the past.
 */

import { getPrisma } from "@/lib/db";
import { publishVoiceAgent } from "@/lib/voice/agent-service";
import { runAppointmentReceptionistActivateHooks } from "@/lib/solutions/appointment-receptionist/activate-hooks";
import {
  getWizardActivationIssues,
  hasBlockingActivationIssues,
} from "@/lib/solutions/appointment-receptionist/capability-checklist";
import { createDefaultWizardState } from "@/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

export type PromoteScheduledResult = {
  scanned: number;
  promoted: number;
  failed: number;
  skipped: number;
  results: Array<{
    agentId: string;
    workspaceId: string;
    ok: boolean;
    error?: string;
    scheduledAt?: string | null;
  }>;
};

function readScheduleMeta(draftConfig: unknown): {
  activationMode: string | null;
  scheduledAt: string | null;
  wizard: Partial<AppointmentReceptionistWizardState>;
} {
  if (!draftConfig || typeof draftConfig !== "object") {
    return { activationMode: null, scheduledAt: null, wizard: {} };
  }
  const draft = draftConfig as Record<string, unknown>;
  const advanced =
    draft.advanced && typeof draft.advanced === "object"
      ? (draft.advanced as Record<string, unknown>)
      : {};
  const wizardRaw =
    advanced.appointmentReceptionistWizard &&
    typeof advanced.appointmentReceptionistWizard === "object"
      ? (advanced.appointmentReceptionistWizard as Record<string, unknown>)
      : {};

  const activationMode =
    (typeof advanced.activationMode === "string" && advanced.activationMode) ||
    (typeof wizardRaw.activationMode === "string" && wizardRaw.activationMode) ||
    null;
  const scheduledAtRaw =
    (typeof advanced.scheduledAt === "string" && advanced.scheduledAt) ||
    (typeof wizardRaw.scheduledAt === "string" && wizardRaw.scheduledAt) ||
    null;

  return {
    activationMode,
    scheduledAt: scheduledAtRaw,
    wizard: wizardRaw as Partial<AppointmentReceptionistWizardState>,
  };
}

async function hydrateWizardState(input: {
  workspaceId: string;
  agent: {
    id: string;
    phoneNumberId: string | null;
    displayName: string | null;
    name: string;
    draftConfig: unknown;
  };
  partial: Partial<AppointmentReceptionistWizardState>;
}): Promise<AppointmentReceptionistWizardState> {
  const prisma = getPrisma();
  const state = { ...createDefaultWizardState(), ...input.partial };

  if (!state.phoneNumberId && input.agent.phoneNumberId) {
    state.phoneNumberId = input.agent.phoneNumberId;
  }
  if (!state.agentName?.trim()) {
    state.agentName = input.agent.displayName || input.agent.name || state.agentName;
  }

  if (state.phoneNumberId && !state.phoneNumberE164) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: state.phoneNumberId, workspaceId: input.workspaceId },
      select: { e164: true },
    });
    if (pn?.e164) state.phoneNumberE164 = pn.e164;
  }

  const calendar = await prisma.voiceCalendarConnection.findFirst({
    where: {
      workspaceId: input.workspaceId,
      status: { in: ["connected", "active", "ok"] },
      provider: { in: ["google", "microsoft", "internal", "calendly"] },
    },
    select: { id: true, provider: true },
  });
  if (calendar) {
    state.calendarConnected = true;
    if (!state.calendarProvider) {
      state.calendarProvider = calendar.provider as AppointmentReceptionistWizardState["calendarProvider"];
    }
  } else {
    // Integrations Calendly (no VoiceCalendarConnection row)
    try {
      const { getConnection } = await import("@/lib/integrations/connections");
      const conn = await getConnection(input.workspaceId, "calendly");
      if (conn?.status === "connected") {
        state.calendarConnected = true;
        state.calendarProvider = "calendly";
      }
    } catch {
      // ignore
    }
  }

  // Prefer draftConfig greeting / voice when snapshot is incomplete.
  const draft = (input.agent.draftConfig || {}) as Record<string, unknown>;
  const callHandling = (draft.callHandling || {}) as Record<string, unknown>;
  const voiceLanguage = (draft.voiceLanguage || {}) as Record<string, unknown>;
  if (!state.openingGreeting?.trim() && typeof callHandling.greeting === "string") {
    state.openingGreeting = callHandling.greeting;
  }
  if (!state.voiceId?.trim() && typeof voiceLanguage.voiceId === "string") {
    state.voiceId = voiceLanguage.voiceId;
  }

  return state;
}

export async function promoteScheduledReceptionists(opts?: {
  now?: Date;
  limit?: number;
  workspaceId?: string;
}): Promise<PromoteScheduledResult> {
  const prisma = getPrisma();
  const now = opts?.now || new Date();
  const limit = opts?.limit || 50;

  const candidates = await prisma.voiceAgent.findMany({
    where: {
      ...(opts?.workspaceId ? { workspaceId: opts.workspaceId } : {}),
      OR: [{ status: "DRAFT" }, { status: "ACTIVE" }, { status: "TESTING" }],
      purpose: "appointment_receptionist",
    },
    take: limit * 3,
    orderBy: { updatedAt: "asc" },
  });

  let scanned = 0;
  let promoted = 0;
  let failed = 0;
  let skipped = 0;
  const results: PromoteScheduledResult["results"] = [];

  for (const agent of candidates) {
    if (promoted + failed + skipped >= limit) break;
    scanned += 1;

    const meta = readScheduleMeta(agent.draftConfig);
    if (meta.activationMode !== "schedule" || !meta.scheduledAt) {
      skipped += 1;
      results.push({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        ok: false,
        error: "missing_schedule_meta",
        scheduledAt: meta.scheduledAt,
      });
      continue;
    }

    const when = new Date(meta.scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() > now.getTime()) {
      skipped += 1;
      continue;
    }

    try {
      const state = await hydrateWizardState({
        workspaceId: agent.workspaceId,
        agent,
        partial: meta.wizard,
      });
      const preIssues = getWizardActivationIssues(state, {
        hasCalendarConnection: Boolean(state.calendarConnected),
        hasKnowledgeText: Boolean(state.businessName?.trim()),
      });
      if (hasBlockingActivationIssues(preIssues)) {
        throw new Error(
          `Activation checklist incomplete: ${preIssues
            .filter((i) => i.severity === "blocking")
            .map((i) => i.id)
            .join(", ")}`,
        );
      }

      const hooks = await runAppointmentReceptionistActivateHooks({
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        state,
        mode: "activate",
      });
      if (hasBlockingActivationIssues(hooks.issues)) {
        throw new Error(
          `Activate hooks blocked: ${hooks.issues
            .filter((i) => i.severity === "blocking")
            .map((i) => i.id)
            .join(", ")}`,
        );
      }

      await publishVoiceAgent(agent.workspaceId, agent.id, "scheduled_activation");

      // Re-read after publish so we don't wipe flow-applied draftConfig.
      const fresh = await prisma.voiceAgent.findUnique({ where: { id: agent.id } });
      const draft = (fresh?.draftConfig || agent.draftConfig || {}) as Record<string, unknown>;
      const advanced = (draft.advanced || {}) as Record<string, unknown>;
      const wizard =
        advanced.appointmentReceptionistWizard &&
        typeof advanced.appointmentReceptionistWizard === "object"
          ? (advanced.appointmentReceptionistWizard as Record<string, unknown>)
          : {};

      await prisma.voiceAgent.update({
        where: { id: agent.id },
        data: {
          draftConfig: {
            ...draft,
            knowledgeBaseIds: hooks.knowledgeBaseId
              ? [hooks.knowledgeBaseId]
              : (draft.knowledgeBaseIds as unknown[]) || [],
            advanced: {
              ...advanced,
              activationMode: "activate_now",
              scheduledAt: meta.scheduledAt,
              scheduledActivatedAt: now.toISOString(),
              appointmentReceptionistWizard: {
                ...wizard,
                ...state,
                activationMode: "activate_now",
                scheduledAt: meta.scheduledAt,
                scheduledActivatedAt: now.toISOString(),
              },
            },
          },
        },
      });

      promoted += 1;
      results.push({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        ok: true,
        scheduledAt: meta.scheduledAt,
      });
      console.info("[promote-scheduled] published receptionist", {
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        scheduledAt: meta.scheduledAt,
      });
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        ok: false,
        error: message,
        scheduledAt: meta.scheduledAt,
      });
      console.warn("[promote-scheduled] publish failed", {
        agentId: agent.id,
        error: message,
      });
    }
  }

  return { scanned, promoted, failed, skipped, results };
}
