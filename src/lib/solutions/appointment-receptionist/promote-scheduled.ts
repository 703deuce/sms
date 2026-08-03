/**
 * Promote appointment / receptionist agents whose activation was scheduled
 * and whose scheduledAt is now in the past.
 *
 * Wizard stores `advanced.activationMode === "schedule"` + `advanced.scheduledAt`
 * and keeps the agent as DRAFT until this publisher runs (unless it was already
 * ACTIVE and schedule was an edit — then status is preserved).
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

function mergeWizardState(
  partial: Partial<AppointmentReceptionistWizardState>,
): AppointmentReceptionistWizardState {
  return { ...createDefaultWizardState(), ...partial };
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
      OR: [
        { status: "DRAFT" },
        { status: "ACTIVE" },
        { status: "TESTING" },
      ],
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
      const state = mergeWizardState(meta.wizard);
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

      const draft = (agent.draftConfig || {}) as Record<string, unknown>;
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
