import { UsersSettingsConnected } from "@/features/settings/kimi/users/users-connected";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import type { PendingInvite, TeamMember } from "@/components/settings/kimi-ui/users/types";
import { loadTeamMembers, requireWorkspaceContext } from "@/lib/workspace-data";
import { loadPendingInvites } from "@/lib/team/invites";

function mapTeamMember(member: {
  membershipId: string;
  name: string;
  email: string;
  role: string;
  isAdmin?: boolean;
}): TeamMember {
  return {
    membershipId: member.membershipId,
    name: member.name,
    email: member.email,
    role: member.role,
    isAdmin: member.isAdmin ?? false,
    lastActive: "—",
    status: "Active",
  };
}

function mapPendingInvite(invite: {
  id: string;
  email: string;
  role: string;
  invitedByName: string | null;
  expiresAt: string;
}): PendingInvite {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    invitedByName: invite.invitedByName,
    expiresAt: invite.expiresAt,
  };
}

export default async function SettingsUsersPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [teamMembers, pendingInvites] = await Promise.all([
    loadTeamMembers(workspaceId),
    loadPendingInvites(workspaceId),
  ]);

  const body = (
    <UsersSettingsConnected
      initialMembers={teamMembers.map(mapTeamMember)}
      initialInvites={pendingInvites.map(mapPendingInvite)}
      hideChrome={isNewUiStage2Enabled()}
    />
  );

  if (isNewUiStage2Enabled()) {
    return body;
  }

  return <div className="kimi-surface kimi-settings-users">{body}</div>;
}
