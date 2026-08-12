import {
  AllConversationsView,
  type ConversationTab,
} from "@/components/realtor/conversations/all-conversations-view";
import { getSession } from "@/lib/auth";
import { mergeRealtorConversations } from "@/lib/realtor/conversations-mock";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import {
  loadContacts,
  loadConversations,
  loadTeamMembers,
} from "@/lib/workspace-data";

const TAB_ALIASES: Record<string, ConversationTab> = {
  all: "all",
  mine: "mine",
  assigned: "mine",
  unassigned: "unassigned",
  unread: "unread",
  calls: "calls",
  sms: "sms",
  email: "email",
};

export default async function RealtorMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const session = await getSession();
  const params = await searchParams;
  const initialTab = TAB_ALIASES[params.tab || "all"] || "all";

  const [conversations, contacts, teamMembers] = await Promise.all([
    loadConversations(workspaceId),
    loadContacts(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  const merged = mergeRealtorConversations(conversations);

  return (
    <div className="px-2 py-4 lg:px-4">
      <AllConversationsView
        conversations={merged}
        contacts={contacts}
        teamMembers={teamMembers}
        currentUserName={session?.name}
        currentUserId={session?.userId}
        initialTab={initialTab}
      />
    </div>
  );
}
