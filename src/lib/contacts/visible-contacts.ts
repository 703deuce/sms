/**
 * Shared visibility rules for user-facing contact queries.
 * Excludes internal automation/system contacts from audience surfaces.
 */
export function visibleContactWhere(
  workspaceId: string,
  opts?: { status?: string; listId?: string; tagId?: string },
) {
  return {
    workspaceId,
    NOT: { customFields: { path: ["systemAutomationContact"], equals: true } },
    ...(opts?.status
      ? {
          status: opts.status.toUpperCase() as
            | "SUBSCRIBED"
            | "UNSUBSCRIBED"
            | "BLOCKED"
            | "INVALID",
        }
      : {}),
    ...(opts?.listId
      ? {
          listMembers: { some: { listId: opts.listId } },
        }
      : {}),
    ...(opts?.tagId
      ? {
          tagMembers: { some: { tagId: opts.tagId } },
        }
      : {}),
  };
}
