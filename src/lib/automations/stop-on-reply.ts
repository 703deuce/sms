import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED"] as const;

/** Complete active executions that opted into stop-on-reply after an inbound SMS. */
export async function stopExecutionsOnReply(workspaceId: string, contactId: string) {
  const prisma = getPrisma();
  const active = await prisma.automationExecution.findMany({
    where: {
      workspaceId,
      contactId,
      status: { in: ["RUNNING", "WAITING", "PAUSED"] },
    },
    take: 50,
  });

  let stopped = 0;
  for (const ex of active) {
    const meta =
      ex.metadata && typeof ex.metadata === "object"
        ? (ex.metadata as Record<string, unknown>)
        : {};
    if (!meta.stopOnReplyActive) continue;

    await prisma.automationExecution.update({
      where: { id: ex.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        nextActionAt: null,
        currentNodeId: null,
        metadata: {
          ...meta,
          customer_replied: true,
          stopReason: "stop_on_reply",
        },
      },
    });
    stopped += 1;
  }
  return { stopped };
}

export async function emitNoResponseAfterWait(
  workspaceId: string,
  contactId: string,
  executionId: string,
) {
  const prisma = getPrisma();
  const ex = await prisma.automationExecution.findUnique({
    where: { id: executionId },
    include: { contact: true },
  });
  if (!ex || TERMINAL.includes(ex.status as (typeof TERMINAL)[number])) return;

  const meta =
    ex.metadata && typeof ex.metadata === "object"
      ? (ex.metadata as Record<string, unknown>)
      : {};
  if (meta.customer_replied) return;

  const { factsFromMetadata } = await import("./metadata");
  const tagRows = await prisma.contactTag.findMany({
    where: { contactId },
    include: { tag: true },
  });
  const tagNames = tagRows.map((r: { tag: { name: string } }) => r.tag.name);
  const facts = factsFromMetadata(meta, ex.contact, tagNames);
  if (facts.customer_replied) return;

  const { emitAutomationEvent } = await import("./events");
  await emitAutomationEvent(workspaceId, "customer.no_response", contactId, {
    executionId,
    afterWait: true,
  });
}
