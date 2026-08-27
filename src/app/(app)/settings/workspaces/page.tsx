import { CreateWorkspaceButton } from "@/components/settings/create-workspace-button";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadWorkspacesForUser, requireWorkspaceContext } from "@/lib/workspace-data";
import { settingsTabs } from "@/lib/settings-tabs";

export default async function SettingsWorkspacesPage() {
  const { session } = await requireWorkspaceContext();
  const activeWorkspaceId = await getActiveWorkspaceId();
  const workspaces = (await loadWorkspacesForUser(session.userId)).filter(
    (ws) => ws.type !== "PERSONAL",
  );

  return (
    <div>
      <PageHeader
        title="Workspaces"
        description="Separate brands, numbers, and contacts under one account."
        actions={<CreateWorkspaceButton />}
      />

      <Tabs items={settingsTabs} />

      <Card>
        <CardTitle>Your workspaces</CardTitle>
        {workspaces.length === 0 ? (
          <EmptyState
            title="No workspaces"
            description="Create a workspace to organize numbers, contacts, and campaigns."
          />
        ) : (
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
              {workspaces.map((ws) => (
                <TR key={ws.id}>
                  <TD className="font-medium">
                    {ws.name}
                    {ws.id === activeWorkspaceId ? (
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
        )}
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
