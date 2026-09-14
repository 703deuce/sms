import { getPrisma } from "@/lib/db";
import type { MctbAutomationState, MctbFollowUpStatus, MctbResponseMode } from "./types";

export async function getOrCreateAutomationState(input: {
  workspaceId: string;
  conversationId: string;
  missedCallEventId?: string | null;
  responseMode?: MctbResponseMode;
}) {
  const prisma = getPrisma();
  const existing = await prisma.mctbConversationAutomationState.findUnique({
    where: { conversationId: input.conversationId },
  });
  if (existing) return existing;
  return prisma.mctbConversationAutomationState.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      missedCallEventId: input.missedCallEventId ?? null,
      state: "waiting_for_caller",
      responseMode: input.responseMode ?? null,
      capturedFieldsJson: {},
    },
  });
}

export async function updateAutomationState(
  conversationId: string,
  patch: {
    state?: MctbAutomationState;
    capturedFieldsJson?: Record<string, unknown>;
    activeFieldId?: string | null;
    humanTakenOverByUserId?: string | null;
    followUpStatus?: MctbFollowUpStatus | null;
    followUpActorUserId?: string | null;
    appointmentId?: string | null;
  },
) {
  const prisma = getPrisma();
  const data: Record<string, unknown> = {};
  if (patch.state) data.state = patch.state;
  if (patch.capturedFieldsJson) data.capturedFieldsJson = patch.capturedFieldsJson;
  if (patch.activeFieldId !== undefined) data.activeFieldId = patch.activeFieldId;
  if (patch.humanTakenOverByUserId !== undefined) {
    data.humanTakenOverByUserId = patch.humanTakenOverByUserId;
    data.humanTakenOverAt = patch.humanTakenOverByUserId ? new Date() : null;
  }
  if (patch.followUpStatus !== undefined) {
    data.followUpStatus = patch.followUpStatus;
    data.followUpAt = patch.followUpStatus ? new Date() : null;
  }
  if (patch.followUpActorUserId !== undefined) {
    data.followUpActorUserId = patch.followUpActorUserId;
  }
  if (patch.appointmentId !== undefined) data.appointmentId = patch.appointmentId;
  return prisma.mctbConversationAutomationState.update({
    where: { conversationId },
    data,
  });
}

export function isHumanActiveState(state: string | null | undefined): boolean {
  return state === "human_active" || state === "needs_human" || state === "resolved";
}

/** Only hard-stop customer SMS automation — not internal follow-up flags like needs_human. */
export function shouldBlockAutomation(state: string | null | undefined): boolean {
  return state === "human_active" || state === "resolved" || state === "appointment_booked";
}
