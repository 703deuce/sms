import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { teamMembers } from "@/lib/mock/data";

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

export default function SettingsUsersPage() {
  return (
    <div>
      <PageHeader
        title="Users & permissions"
        description="Manage team access, roles, and inbox assignment permissions."
        actions={<Button>Invite user</Button>}
      />

      <Tabs items={settingsTabs} />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Team members</CardTitle>
          <span className="text-xs text-muted-foreground">{teamMembers.length} users</span>
        </div>
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
              <TR key={member.id}>
                <TD className="font-medium">{member.name}</TD>
                <TD className="text-muted-foreground">{member.email}</TD>
                <TD>
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                    {member.role}
                  </span>
                </TD>
                <TD>{member.isAdmin ? "Yes" : "—"}</TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
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
