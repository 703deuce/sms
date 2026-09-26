import { Suspense } from "react";
import { KimiConversationsConnected } from "@/components/inbox/kimi-conversations-connected";
import { inboxFiltersFromUrlParams } from "@/lib/inbox/conversation-url-filters";
import { loadInboxPermissions } from "@/lib/inbox/inbox-access";
import { getPrisma } from "@/lib/db";
import { loadMctbOverview } from "@/lib/mctb/overview";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import {
  loadConversations,
  loadTeamMembers,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import {
  defaultMctbInboxBusinessFromSetup,
  NewUiMctbConversationsPage,
} from "@/newui-transplant/connected/mctb/conversations-page";

/** MCTB Conversations — shared Kimi inbox with MCTB product filter (spec 04). */
export default async function MctbConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceId, session } = await requireWorkspaceContext();
  const params = await searchParams;

  if (isNewUiStage2Enabled()) {
    const [overview, workspace] = await Promise.all([
      loadMctbOverview(workspaceId),
      getPrisma().workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    ]);
    const business = defaultMctbInboxBusinessFromSetup({
      workspaceName: workspace?.name ?? "Workspace",
      businessLineE164: overview.setupHealth.businessLine,
      senderLabel: overview.setupHealth.senderLabel,
      timezone: overview.kpis.timeZone,
    });
    const initialConversationId =
      typeof params.conversation === "string" ? params.conversation : undefined;
    const initialFilter = params.filter === "needs_reply" ? "Needs reply" : "All";
    return (
      <NewUiMctbConversationsPage
        initialConversationId={initialConversationId}
        initialFilter={initialFilter}
        business={business}
      />
    );
  }

  const mergedParams = { ...params, product: "mctb" };
  const listFilters = inboxFiltersFromUrlParams(mergedParams);
  const [conversations, teamMembers, inboxPermissions] = await Promise.all([
    loadConversations(workspaceId, listFilters, session.userId),
    loadTeamMembers(workspaceId),
    loadInboxPermissions(workspaceId),
  ]);

  const currentMember = teamMembers.find((m) => m.id === session.userId);
  const initialConversationId =
    typeof params.conversation === "string" ? params.conversation : null;
  const initialContactId =
    (typeof params.contactId === "string" && params.contactId) ||
    (typeof params.contact === "string" && params.contact) ||
    null;
  const initialDraft =
    typeof params.draft === "string" ? decodeURIComponent(params.draft) : "";

  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading conversations…
        </div>
      }
    >
      <div
        className="kimi-surface kimi-conversations"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <KimiConversationsConnected
          initialConversations={conversations}
          teamMembers={teamMembers}
          currentUserId={session.userId}
          currentUserName={currentMember?.name ?? session.name ?? "You"}
          initialPermissions={inboxPermissions}
          initialConversationId={initialConversationId}
          initialContactId={initialContactId}
          initialDraft={initialDraft}
        />
      </div>
    </Suspense>
  );
}
