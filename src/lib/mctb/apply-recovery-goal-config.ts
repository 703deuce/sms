import "server-only";

import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import {
  getRecoveryGoalDefinition,
  parseRecoveryGoalId,
  type MctbRecoveryGoalId,
} from "@/lib/mctb/recovery-goals";

export async function applyMctbRecoveryGoalConfiguration(input: {
  workspaceId: string;
  goalId: MctbRecoveryGoalId;
  actorUserId?: string | null;
  messageOverride?: string | null;
}): Promise<void> {
  const def = getRecoveryGoalDefinition(input.goalId);
  const message = (input.messageOverride?.trim() || def.defaultOpener).trim();

  await updateMissedCallTextConfig({
    workspaceId: input.workspaceId,
    patch: {
      initial_message: message,
      request_form_fields_json: def.requestFormPreset,
    },
    actor: input.actorUserId ?? undefined,
    source: "mctb_recovery_goal",
  });

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const root =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    root.mctb && typeof root.mctb === "object" ? (root.mctb as Record<string, unknown>) : {};

  await prisma.workspace.update({
    where: { id: input.workspaceId },
    data: {
      customFieldsConfig: {
        ...root,
        mctb: {
          ...mctb,
          recoveryGoal: input.goalId,
          recoveryGoalUsesBookingLink: def.usesBookingLink,
        },
      },
    },
  });
}

export async function readMctbRecoveryGoalId(workspaceId: string): Promise<MctbRecoveryGoalId | null> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const root =
    ws?.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    root.mctb && typeof root.mctb === "object" ? (root.mctb as Record<string, unknown>) : {};
  return parseRecoveryGoalId(mctb.recoveryGoal);
}
