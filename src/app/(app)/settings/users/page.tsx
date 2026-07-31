import { TeamMemberRow } from "@/components/settings/team-member-row";
import { InviteUserButton } from "@/components/settings/invite-user-button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { loadTeamMembers, requireWorkspaceContext } from "@/lib/workspace-data";

const settingsTabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Users", href: "/settings/users" },
  { label: "Workspaces", href: "/settings/workspaces" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Limits", href: "/settings/limits" },
  { label: "Security", href: "/settings/security" },
  { label: "Branding", href: "/settings/branding" },
  { label: "Data", href: "/settings/data" },
];

export default async function SettingsUsersPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const teamMembers = await loadTeamMembers(workspaceId);

  return (
    <div>
      <PageHeader
        title="Users & permissions"
        description="Manage team access, roles, and inbox assignment permissions."
        actions={<InviteUserButton />}
      />

      <Tabs items={settingsTabs} />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Team members</CardTitle>
          <span className="text-xs text-muted-foreground">{teamMembers.length} users</span>
        </div>
        {teamMembers.length === 0 ? (
          <EmptyState
            title="No team members yet"
            description="Invite colleagues to collaborate on campaigns and inbox."
            actionLabel="Invite user"
            actionHref="/settings/users"
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Admin</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {teamMembers.map((member) => (
                <TeamMemberRow
                  key={member.membershipId}
                  membershipId={member.membershipId}
                  name={member.name}
                  email={member.email}
                  role={member.role}
                  isAdmin={member.isAdmin ?? false}
                />
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Role permissions</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { role: "Owner", desc: "Full account access, billing, and compliance" },
            { role: "Campaign creator", desc: "Create and send campaigns, manage templates" },
            { role: "Inbox agent", desc: "Reply to conversations, assign threads" },
            { role: "Analyst", desc: "View reports and export data" },
          ].map((item) => (
            <div key={item.role} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{item.role}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
