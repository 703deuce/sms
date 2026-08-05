/**
 * Shared platform event model.
 * Persists events for reporting/debugging and fans out to AutomationFlow triggers.
 */

import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { emitAutomationEvent } from "@/lib/automations/events";

export const PLATFORM_EVENT_TYPES = [
  "CONTACT_CREATED",
  "FORM_SUBMITTED",
  "INQUIRY_RECEIVED",
  "CALL_STARTED",
  "CALL_COMPLETED",
  "CALL_MISSED",
  "CALL_TRANSFERRED",
  "AI_CALL_COMPLETED",
  "APPOINTMENT_BOOKED",
  "APPOINTMENT_CANCELLED",
  "MESSAGE_SENT",
  "MESSAGE_RECEIVED",
  "EMAIL_SENT",
  "EMAIL_OPENED",
  "CRM_FIELD_CHANGED",
  "AUTOMATION_STARTED",
  "AUTOMATION_COMPLETED",
  "AUTOMATION_FAILED",
  "SOLUTION_SETUP_CREATED",
  "SOLUTION_SETUP_UPDATED",
] as const;

export type PlatformEventType = (typeof PLATFORM_EVENT_TYPES)[number] | string;

export type EmitPlatformEventInput = {
  workspaceId: string;
  type: PlatformEventType;
  contactId?: string | null;
  solutionSetupId?: string | null;
  automationId?: string | null;
  agentId?: string | null;
  campaignId?: string | null;
  callId?: string | null;
  messageId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

/** Map platform event types → automation event keys used by emitAutomationEvent. */
const PLATFORM_TO_AUTOMATION: Record<string, string> = {
  CONTACT_CREATED: "contact.created",
  FORM_SUBMITTED: "form.submitted",
  CALL_STARTED: "call.created",
  CALL_COMPLETED: "call.completed",
  CALL_MISSED: "call.missed",
  CALL_TRANSFERRED: "call.transferred",
  // AI_CALL_COMPLETED is logged + used to resume wait_for_call_result;
  // it must not re-trigger call_completed enrollments (CALL_COMPLETED owns that).
  APPOINTMENT_BOOKED: "call.appointment_booked",
};

export async function emitPlatformEvent(input: EmitPlatformEventInput) {
  const prisma = getPrisma();
  const id = createId();
  const createdAt = new Date().toISOString();

  try {
    await prisma.platformEvent.create({
      data: {
        id,
        workspaceId: input.workspaceId,
        type: input.type,
        contactId: input.contactId || null,
        solutionSetupId: input.solutionSetupId || null,
        automationId: input.automationId || null,
        agentId: input.agentId || null,
        campaignId: input.campaignId || null,
        callId: input.callId || null,
        messageId: input.messageId || null,
        payload: (input.payload || {}) as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey || null,
        createdAt,
      },
    });
  } catch (err) {
    // Unique idempotency collisions mean this event was already fully handled.
    // Do NOT fan out again (would duplicate enrollments / resumes).
    const message = err instanceof Error ? err.message : String(err);
    if (/duplicate|unique/i.test(message)) {
      return { id, deduped: true as const };
    }
    throw err;
  }

  const automationKey = PLATFORM_TO_AUTOMATION[input.type];
  if (automationKey && input.contactId) {
    await emitAutomationEvent(
      input.workspaceId,
      automationKey,
      input.contactId,
      {
        ...(input.payload || {}),
        callId: input.callId,
        agentId: input.agentId,
        solutionSetupId: input.solutionSetupId,
        automationId: input.automationId,
      },
    ).catch(() => undefined);
  }

  // Resume WAIT_FOR_CALL_RESULT executions when a call completes.
  // Prefer AI_CALL_COMPLETED / CALL_MISSED for resume; CALL_COMPLETED also
  // resumes so non-AI call waits still wake. Deduped by execution status.
  if (
    (input.type === "CALL_COMPLETED" ||
      input.type === "AI_CALL_COMPLETED" ||
      input.type === "CALL_MISSED") &&
    input.callId
  ) {
    await resumeWaitForCallResult(input).catch(() => undefined);
  }

  return { id, deduped: false as const };
}

async function resumeWaitForCallResult(input: EmitPlatformEventInput) {
  if (!input.callId) return;
  const prisma = getPrisma();

  // Prefer pendingCallId match (works without contactId). Also scan
  // contact-scoped WAITING/RUNNING rows that may not have bound a call yet.
  const byPending = await prisma.automationExecution.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: { in: ["WAITING", "RUNNING"] },
      metadata: {
        path: ["pendingCallId"],
        equals: input.callId,
      },
    },
    take: 20,
  });
  const byContact = input.contactId
    ? await prisma.automationExecution.findMany({
        where: {
          workspaceId: input.workspaceId,
          contactId: input.contactId,
          status: { in: ["WAITING", "RUNNING"] },
        },
        take: 40,
      })
    : [];
  const seen = new Set<string>();
  const candidates = [...byPending, ...byContact].filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  const callResult = {
    callId: input.callId,
    type: input.type,
    ...(input.payload || {}),
  };

  for (const exec of candidates) {
    const meta = (exec.metadata || {}) as Record<string, unknown>;
    const vars = (meta.variables || {}) as Record<string, unknown>;
    const pending =
      (typeof meta.pendingCallId === "string" && meta.pendingCallId) ||
      (typeof vars.callId === "string" && vars.callId) ||
      null;

    const matchesCall = pending === input.callId;
    const waitingForResult = meta.waitingForCallResult === true;
    // If we have a pendingCallId and it doesn't match, skip.
    if (pending && !matchesCall) continue;
    // Without pendingCallId, only attach to waiters for this contact.
    if (!pending && !waitingForResult) continue;
    if (!pending && !input.contactId) continue;

    // Always stash the result so wait_for_call_result can consume it even if
    // the call ended before the execution reached WAITING.
    const nextMeta = {
      ...meta,
      pendingCallId: pending || input.callId,
      callResultConsumed: false,
      callResult,
    };

    if (exec.status === "WAITING" && waitingForResult) {
      await prisma.automationExecution.update({
        where: { id: exec.id },
        data: {
          status: "RUNNING",
          nextActionAt: null,
          metadata: {
            ...nextMeta,
            waitingForCallResult: true,
          } as Prisma.InputJsonValue,
        },
      });
      await enqueueJob({
        jobType: "automation_advance",
        queueName: "automations",
        workspaceId: input.workspaceId,
        payload: { executionId: exec.id },
        idempotencyKey: `automation-advance:${exec.id}:call-result:${input.callId}`,
      }).catch(() => undefined);
    } else if (
      exec.status === "RUNNING" &&
      matchesCall &&
      (waitingForResult || Boolean(pending))
    ) {
      // Stash + wake: runner may have parked on wait_for_call_result without
      // entering WAITING (or call ended mid-advance). Re-enqueue advance.
      await prisma.automationExecution.update({
        where: { id: exec.id },
        data: {
          metadata: nextMeta as Prisma.InputJsonValue,
        },
      });
      await enqueueJob({
        jobType: "automation_advance",
        queueName: "automations",
        workspaceId: input.workspaceId,
        payload: { executionId: exec.id },
        idempotencyKey: `automation-advance:${exec.id}:call-result:${input.callId}`,
      }).catch(() => undefined);
    } else {
      await prisma.automationExecution.update({
        where: { id: exec.id },
        data: {
          metadata: nextMeta as Prisma.InputJsonValue,
        },
      });
    }
  }
}
