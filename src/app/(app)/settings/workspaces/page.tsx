import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { workspaces } from "@/lib/mock/data";

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

export default function SettingsWorkspacesPage() {
  return (
    <div>
      <PageHeader
        title="Workspaces"
        description="Separate brands, numbers, and contacts under one account."
        actions={<Button>Create workspace</Button>}
      />

      <Tabs items={settingsTabs} />

      <Card>
        <CardTitle>Your workspaces</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Slug</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {workspaces.map((ws, index) => (
              <TR key={ws.id}>
                <TD className="font-medium">
                  {ws.name}
                  {index === 0 ? (
                    <span className="ml-2 text-xs text-muted-foreground">(current)</span>
                  ) : null}
                </TD>
                <TD className="font-mono text-sm text-muted-foreground">{ws.slug}</TD>
                <TD>
                  <StatusChip status="Active" />
                </TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    Manage
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card className="mt-4">
        <CardTitle>Workspace isolation</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Each workspace has its own phone numbers, contacts, campaigns, and compliance registration. Users can be
          granted access to one or more workspaces.
        </p>
      </Card>
    </div>
  );
}
