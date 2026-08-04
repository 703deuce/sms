import type { Prisma } from "@/lib/domain";
import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

export type ExecutionFacts = {
  review_received?: boolean;
  positive_review?: boolean;
  negative_feedback?: boolean;
  customer_replied?: boolean;
  link_clicked?: boolean;
  message_delivered?: boolean;
  tag_has?: boolean;
  no_response?: boolean;
  review_request_created?: boolean;
  review_request_sent?: boolean;
};

export async function mergeExecutionMetadata(
  executionId: string,
  patch: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const ex = await prisma.automationExecution.findUnique({ where: { id: executionId } });
  if (!ex) return;
  const current =
    ex.metadata && typeof ex.metadata === "object"
      ? (ex.metadata as Record<string, unknown>)
      : {};
  await prisma.automationExecution.update({
    where: { id: executionId },
    data: {
      metadata: { ...current, ...patch } as Prisma.InputJsonValue,
    },
  });
}

export async function markFactsForContact(
  workspaceId: string,
  contactId: string,
  patch: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const active = await prisma.automationExecution.findMany({
    where: {
      workspaceId,
      contactId,
      status: { in: ["RUNNING", "WAITING", "PAUSED"] },
    },
    take: 50,
  });
  for (const ex of active) {
    await mergeExecutionMetadata(ex.id, patch);
    // Wake WAITING executions so reply-sensitive conditions can run early
    // (e.g. Missed Call Text Back wait-for-reply window).
    if (ex.status === "WAITING") {
      const meta = (ex.metadata || {}) as Record<string, unknown>;
      // Do not steal wait_for_call_result waits — those resume via call events.
      if (meta.waitingForCallResult === true) {
        continue;
      }
      await prisma.automationExecution.update({
        where: { id: ex.id },
        data: { status: "RUNNING", nextActionAt: null },
      });
    }
    if (ex.status === "PAUSED") continue;
    await enqueueJob({
      jobType: "automation_advance",
      queueName: "automations",
      workspaceId,
      payload: { executionId: ex.id },
      idempotencyKey: `automation-fact:${ex.id}:${Object.keys(patch).join(",")}`,
    });
  }
}

export async function markFactsFromMessageClick(workspaceId: string, toPhone: string) {
  const contact = await getPrisma().contact.findFirst({
    where: { workspaceId, phone: toPhone },
  });
  if (!contact) return;
  await markFactsForContact(workspaceId, contact.id, {
    link_clicked: true,
    review_request_clicked: true,
  });
  const { emitAutomationEvent } = await import("./events");
  await emitAutomationEvent(workspaceId, "review_request.clicked", contact.id);
}

export function factsFromMetadata(
  metadata: unknown,
  contact: {
    customFields?: unknown;
    lastReply?: Date | null;
    firstName?: string | null;
    email?: string | null;
    company?: string | null;
  },
  tagNames: string[],
): ExecutionFacts {
  const facts: ExecutionFacts = { no_response: true };
  if (metadata && typeof metadata === "object") {
    const m = metadata as Record<string, unknown>;
    for (const key of Object.keys(m)) {
      if (key in facts || key.endsWith("_received") || key.endsWith("_sent")) {
        (facts as Record<string, unknown>)[key] = Boolean(m[key]);
      }
    }
    facts.review_received = Boolean(m.review_received);
    facts.positive_review = Boolean(m.positive_review);
    facts.negative_feedback = Boolean(m.negative_feedback);
    facts.customer_replied = Boolean(m.customer_replied);
    facts.link_clicked = Boolean(m.link_clicked);
    facts.message_delivered = Boolean(m.message_delivered);
    facts.no_response = !facts.customer_replied;
  }
  if (contact.lastReply) {
    facts.customer_replied = true;
    facts.no_response = false;
  }
  if (contact.customFields && typeof contact.customFields === "object") {
    const cf = contact.customFields as Record<string, unknown>;
    if (cf.review_received) facts.review_received = true;
    if (cf.positive_review) facts.positive_review = true;
    if (cf.negative_feedback) facts.negative_feedback = true;
  }
  facts.tag_has = tagNames.length > 0;
  return facts;
}
