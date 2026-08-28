import { getPrisma } from "@/lib/db";
import type { AutomationCanvasNode, AutomationDefinition } from "../types";
import { mergeExecutionMetadata } from "../metadata";
import { outcomeResult } from "./resolve-outcome";

export async function resolveConversationForExecution(
  workspaceId: string,
  contactId: string,
  executionMetadata: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const vars = (executionMetadata.variables || {}) as Record<string, unknown>;
  const conversationId =
    (typeof executionMetadata.conversationId === "string" &&
      executionMetadata.conversationId) ||
    (typeof vars.conversationId === "string" && vars.conversationId) ||
    null;
  if (conversationId) {
    const byId = await prisma.conversation.findFirst({
      where: { id: conversationId, workspaceId, contactId },
    });
    if (byId) return byId;
  }
  return prisma.conversation.findFirst({
    where: { workspaceId, contactId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function runAssignInboxConversation(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  ctx: { workspaceId: string; contactId: string; executionId: string },
) {
  const prisma = getPrisma();
  const exec = await prisma.automationExecution.findUnique({
    where: { id: ctx.executionId },
    select: { metadata: true },
  });
  const meta = (exec?.metadata || {}) as Record<string, unknown>;
  const conversation = await resolveConversationForExecution(
    ctx.workspaceId,
    ctx.contactId,
    meta,
  );
  if (!conversation) {
    return outcomeResult(def, node.id, "conversation_not_found");
  }

  const cfg = node.data.config || {};
  const assigneeId = String(cfg.assigneeId || "").trim() || null;
  if (cfg.onlyIfUnassigned && conversation.assigneeId) {
    return outcomeResult(def, node.id, "assigned", { skipped: true, alreadyAssigned: true });
  }
  if (!cfg.reassignAllowed && conversation.assigneeId && assigneeId && conversation.assigneeId !== assigneeId) {
    return outcomeResult(def, node.id, "failed", { error: "reassign_not_allowed" });
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { assigneeId },
  });

  try {
    const { enrollForTrigger } = await import("../enroll");
    await enrollForTrigger(ctx.workspaceId, "inbox_conversation_assigned", ctx.contactId, {
      conversationId: conversation.id,
      assigneeId: assigneeId || undefined,
      previousAssigneeId: conversation.assigneeId || undefined,
    });
  } catch {
    /* non-fatal */
  }

  return outcomeResult(def, node.id, "assigned", {
    conversationId: updated.id,
    assigneeId,
  });
}

export async function runUnassignInboxConversation(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  ctx: { workspaceId: string; contactId: string; executionId: string },
) {
  const prisma = getPrisma();
  const exec = await prisma.automationExecution.findUnique({
    where: { id: ctx.executionId },
    select: { metadata: true },
  });
  const meta = (exec?.metadata || {}) as Record<string, unknown>;
  const conversation = await resolveConversationForExecution(
    ctx.workspaceId,
    ctx.contactId,
    meta,
  );
  if (!conversation) {
    return outcomeResult(def, node.id, "conversation_not_found");
  }
  if (!conversation.assigneeId) {
    return outcomeResult(def, node.id, "already_unassigned");
  }
  const filter = String(node.data.config?.assigneeFilterId || "").trim();
  if (filter && conversation.assigneeId !== filter) {
    return outcomeResult(def, node.id, "failed", { error: "assignee_filter_mismatch" });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { assigneeId: null },
  });

  try {
    const { enrollForTrigger } = await import("../enroll");
    await enrollForTrigger(ctx.workspaceId, "inbox_conversation_unassigned", ctx.contactId, {
      conversationId: conversation.id,
      previousAssigneeId: conversation.assigneeId || undefined,
    });
  } catch {
    /* non-fatal */
  }

  return outcomeResult(def, node.id, "unassigned", { conversationId: conversation.id });
}

export async function runTagInboxConversation(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  ctx: { workspaceId: string; contactId: string; executionId: string },
) {
  const prisma = getPrisma();
  const exec = await prisma.automationExecution.findUnique({
    where: { id: ctx.executionId },
    select: { metadata: true },
  });
  const meta = (exec?.metadata || {}) as Record<string, unknown>;
  const conversation = await resolveConversationForExecution(
    ctx.workspaceId,
    ctx.contactId,
    meta,
  );
  if (!conversation) {
    return outcomeResult(def, node.id, "conversation_not_found");
  }

  const tags = Array.isArray(node.data.config?.tags)
    ? (node.data.config.tags as string[]).map(String).filter(Boolean)
    : [];
  if (!tags.length) {
    return outcomeResult(def, node.id, "failed", { error: "no_tags" });
  }

  const current = new Set(conversation.tags || []);
  const toAdd = tags.filter((t) => !current.has(t));
  if (!toAdd.length) {
    return outcomeResult(def, node.id, "already_tagged", { tags });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { tags: [...current, ...toAdd] },
  });

  for (const tag of toAdd) {
    try {
      const { enrollForTrigger } = await import("../enroll");
      await enrollForTrigger(ctx.workspaceId, "inbox_conversation_tagged", ctx.contactId, {
        conversationId: conversation.id,
        tag,
      });
    } catch {
      /* non-fatal */
    }
  }

  return outcomeResult(def, node.id, "tagged", { tags: toAdd });
}

export async function runUntagInboxConversation(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  ctx: { workspaceId: string; contactId: string; executionId: string },
) {
  const prisma = getPrisma();
  const exec = await prisma.automationExecution.findUnique({
    where: { id: ctx.executionId },
    select: { metadata: true },
  });
  const meta = (exec?.metadata || {}) as Record<string, unknown>;
  const conversation = await resolveConversationForExecution(
    ctx.workspaceId,
    ctx.contactId,
    meta,
  );
  if (!conversation) {
    return outcomeResult(def, node.id, "conversation_not_found");
  }

  const cfg = node.data.config || {};
  const removeAll = cfg.removeAll === true;
  const tags = removeAll
    ? [...(conversation.tags || [])]
    : Array.isArray(cfg.tags)
      ? (cfg.tags as string[]).map(String).filter(Boolean)
      : [];

  if (!tags.length) {
    return outcomeResult(def, node.id, "tag_wasnt_present");
  }

  const current = new Set(conversation.tags || []);
  const toRemove = tags.filter((t) => current.has(t));
  if (!toRemove.length) {
    return outcomeResult(def, node.id, "tag_wasnt_present");
  }

  const next = (conversation.tags || []).filter((t) => !toRemove.includes(t));
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { tags: next },
  });

  for (const tag of toRemove) {
    try {
      const { enrollForTrigger } = await import("../enroll");
      await enrollForTrigger(ctx.workspaceId, "inbox_conversation_untagged", ctx.contactId, {
        conversationId: conversation.id,
        tag,
      });
    } catch {
      /* non-fatal */
    }
  }

  return outcomeResult(def, node.id, "untagged", { tags: toRemove });
}

export async function runSetInboxConversationStatus(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  ctx: { workspaceId: string; contactId: string; executionId: string },
) {
  const prisma = getPrisma();
  const exec = await prisma.automationExecution.findUnique({
    where: { id: ctx.executionId },
    select: { metadata: true },
  });
  const meta = (exec?.metadata || {}) as Record<string, unknown>;
  const conversation = await resolveConversationForExecution(
    ctx.workspaceId,
    ctx.contactId,
    meta,
  );
  if (!conversation) {
    return outcomeResult(def, node.id, "conversation_not_found");
  }

  const status = String(node.data.config?.status || "OPEN").toUpperCase() as
    | "OPEN"
    | "PENDING"
    | "CLOSED";
  if (conversation.status === status) {
    return outcomeResult(def, node.id, "already_in_status", { status });
  }

  const previousStatus = conversation.status;
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status },
  });

  try {
    const { enrollForTrigger } = await import("../enroll");
    await enrollForTrigger(ctx.workspaceId, "inbox_conversation_status_changed", ctx.contactId, {
      conversationId: conversation.id,
      fromStatus: previousStatus,
      toStatus: status,
    });
  } catch {
    /* non-fatal */
  }

  return outcomeResult(def, node.id, "updated", { status, previousStatus });
}

export async function runMarkInboxConversationRead(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  ctx: { workspaceId: string; contactId: string; executionId: string },
) {
  const prisma = getPrisma();
  const exec = await prisma.automationExecution.findUnique({
    where: { id: ctx.executionId },
    select: { metadata: true },
  });
  const meta = (exec?.metadata || {}) as Record<string, unknown>;
  const conversation = await resolveConversationForExecution(
    ctx.workspaceId,
    ctx.contactId,
    meta,
  );
  if (!conversation) {
    return outcomeResult(def, node.id, "conversation_not_found");
  }

  const unread = String(node.data.config?.readState || "read") === "unread";
  if (conversation.unread === unread) {
    return outcomeResult(def, node.id, "already_in_state", { unread });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { unread },
  });

  return outcomeResult(def, node.id, "updated", { unread });
}

export async function runCreateInboxConversationNote(
  node: AutomationCanvasNode,
  def: AutomationDefinition,
  ctx: {
    workspaceId: string;
    contactId: string;
    executionId: string;
    mergeBody: (body: string) => Promise<string>;
  },
) {
  const prisma = getPrisma();
  const exec = await prisma.automationExecution.findUnique({
    where: { id: ctx.executionId },
    select: { metadata: true },
  });
  const meta = (exec?.metadata || {}) as Record<string, unknown>;
  const conversation = await resolveConversationForExecution(
    ctx.workspaceId,
    ctx.contactId,
    meta,
  );
  if (!conversation) {
    return outcomeResult(def, node.id, "conversation_not_found");
  }

  const raw = String(node.data.config?.body || "").trim();
  if (!raw) {
    return outcomeResult(def, node.id, "failed", { error: "empty_note" });
  }
  const body = await ctx.mergeBody(raw);
  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "note",
      body,
    },
  });

  return outcomeResult(def, node.id, "note_created", { conversationId: conversation.id });
}

export async function evaluateInboxCondition(
  blockType: string,
  config: Record<string, unknown>,
  conversation: {
    assigneeId: string | null;
    status: string;
    tags: string[];
    unread: boolean;
  } | null,
): Promise<string> {
  if (!conversation) return "conversation_not_found";

  if (blockType === "condition_inbox_unread") {
    return conversation.unread ? "yes" : "no";
  }
  if (blockType === "condition_inbox_status") {
    const statuses = Array.isArray(config.statuses)
      ? (config.statuses as string[]).map((s) => s.toUpperCase())
      : [];
    const is = config.match !== "is_not";
    const match = statuses.includes(conversation.status);
    return is === match ? "yes" : "no";
  }
  if (blockType === "condition_inbox_tags") {
    const tags = Array.isArray(config.tags)
      ? (config.tags as string[]).map(String)
      : [];
    const current = new Set(conversation.tags || []);
    const mode = String(config.matchMode || "has_any");
    let match = false;
    if (mode === "has_all") match = tags.every((t) => current.has(t));
    else if (mode === "has_none") match = tags.every((t) => !current.has(t));
    else match = tags.some((t) => current.has(t));
    return match ? "yes" : "no";
  }
  if (blockType === "condition_inbox_assignee") {
    const mode = String(config.assigneeMode || "anyone");
    const matchOp = config.match !== "is_not";
    let match = false;
    if (mode === "unassigned") match = !conversation.assigneeId;
    else if (mode === "teammate") {
      match = conversation.assigneeId === String(config.assigneeId || "");
    } else {
      match = Boolean(conversation.assigneeId);
    }
    return match === matchOp ? "yes" : "no";
  }
  return "no";
}

export async function stashConversationOnExecution(
  executionId: string,
  conversationId: string,
) {
  await mergeExecutionMetadata(executionId, { conversationId });
}
