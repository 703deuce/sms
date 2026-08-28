/**
 * Emit automation triggers when inbox conversation state changes.
 */

import { emitAutomationEvent } from "../events";

export async function emitInboxAutomationEvents(input: {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  previous: {
    status?: string;
    assigneeId?: string | null;
    tags?: string[];
    unread?: boolean;
  };
  next: {
    status?: string;
    assigneeId?: string | null;
    tags?: string[];
    unread?: boolean;
  };
}) {
  const { workspaceId, contactId, conversationId, previous, next } = input;

  if (next.status && previous.status && next.status !== previous.status) {
    await emitAutomationEvent(workspaceId, "inbox.status_changed", contactId, {
      conversationId,
      fromStatus: previous.status,
      toStatus: next.status,
    }).catch(() => undefined);
  }

  if (next.assigneeId !== undefined && next.assigneeId !== previous.assigneeId) {
    if (next.assigneeId) {
      await emitAutomationEvent(workspaceId, "inbox.assigned", contactId, {
        conversationId,
        assigneeId: next.assigneeId,
        previousAssigneeId: previous.assigneeId || undefined,
      }).catch(() => undefined);
    } else if (previous.assigneeId) {
      await emitAutomationEvent(workspaceId, "inbox.unassigned", contactId, {
        conversationId,
        previousAssigneeId: previous.assigneeId,
      }).catch(() => undefined);
    }
  }

  if (next.tags) {
    const prev = new Set(previous.tags || []);
    const nxt = new Set(next.tags);
    for (const tag of nxt) {
      if (!prev.has(tag)) {
        await emitAutomationEvent(workspaceId, "inbox.tagged", contactId, {
          conversationId,
          tag,
        }).catch(() => undefined);
      }
    }
    for (const tag of prev) {
      if (!nxt.has(tag)) {
        await emitAutomationEvent(workspaceId, "inbox.untagged", contactId, {
          conversationId,
          tag,
        }).catch(() => undefined);
      }
    }
  }
}
