import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Key, Plus } from "lucide-react";
import Link from "next/link";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

const apiKeys = [
  {
    id: "key_1",
    name: "Production",
    prefix: "trnv_live_••••4f2a",
    created: "2026-05-12",
    lastUsed: "2026-07-27T14:22:00Z",
    status: "Active" as const,
  },
  {
    id: "key_2",
    name: "Staging",
    prefix: "trnv_test_••••9b1c",
    created: "2026-06-01",
    lastUsed: "2026-07-25T09:10:00Z",
    status: "Active" as const,
  },
  {
    id: "key_3",
    name: "Legacy import script",
    prefix: "trnv_live_••••7d3e",
    created: "2025-11-20",
    lastUsed: null,
    status: "Archived" as const,
  },
];

export default function IntegrationsApiPage() {
  return (
    <div>
      <PageHeader
        title="API keys"
        description="Create and manage API keys for programmatic access to contacts, campaigns, and messages."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Create key
          </Button>
        }
      />

      <Tabs items={integrationTabs} />

      <Card className="mb-4">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
          <CardTitle>Active keys</CardTitle>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Key</TH>
              <TH>Created</TH>
              <TH>Last used</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {apiKeys.map((key) => (
              <TR key={key.id}>
                <TD className="font-medium">{key.name}</TD>
                <TD className="font-mono text-sm text-muted-foreground">{key.prefix}</TD>
                <TD className="text-muted-foreground">
                  {new Date(key.created).toLocaleDateString()}
                </TD>
                <TD className="text-muted-foreground">
                  {key.lastUsed ? new Date(key.lastUsed).toLocaleString() : "Never"}
                </TD>
                <TD>
                  <StatusChip status={key.status} />
                </TD>
                <TD className="text-right">
                  {key.status === "Active" ? (
                    <Button variant="ghost" size="sm">
                      Revoke
                    </Button>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Create API key</CardTitle>
          <form className="mt-4 space-y-4">
            <div>
              <Label htmlFor="keyName">Key name</Label>
              <Input id="keyName" placeholder="e.g. CRM sync" />
            </div>
            <div>
              <Label htmlFor="keyScope">Scope</Label>
              <select
                id="keyScope"
                className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                defaultValue="full"
              >
                <option value="full">Full access</option>
                <option value="read">Read only</option>
                <option value="send">Send messages only</option>
              </select>
            </div>
            <Button type="button">Generate key</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>API documentation</CardTitle>
          <p className="mt-3 text-sm text-muted-foreground">
            Use the REST API to create contacts, send campaigns, and retrieve message status.
            Authenticate with your API key in the Authorization header.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-medium">Base URL:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">https://api.transovo.com/v1</code>
            </p>
            <p>
              <span className="font-medium">Rate limit:</span> 100 requests/minute per key
            </p>
          </div>
          <Link
            href="/integrations/logs"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            View developer logs →
          </Link>
        </Card>
      </div>
    </div>
  );
}
