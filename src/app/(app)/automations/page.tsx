import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { automations } from "@/lib/mock/data";
import { formatNumber, formatPercent } from "@/lib/utils";
import { Plus, Workflow } from "lucide-react";
import Link from "next/link";

const automationTabs = [
  { label: "Flows", href: "/automations" },
  { label: "Templates", href: "/automations/templates" },
  { label: "Logs", href: "/automations/logs" },
];

function formatUpdated(at: string) {
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AutomationsPage() {
  const activeCount = automations.filter((a) => a.status === "Active").length;
  const totalEnrolled = automations.reduce((sum, a) => sum + a.enrolled, 0);
  const totalMessages = automations.reduce((sum, a) => sum + a.messagesSent, 0);

  return (
    <div>
      <PageHeader
        title="Automations"
        description="Build SMS flows that trigger on contact events, keywords, and time-based rules."
        actions={
          <Link href="/automations/new">
            <Button>
              <Plus className="h-4 w-4" />
              New flow
            </Button>
          </Link>
        }
      />

      <Tabs items={automationTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active flows" value={formatNumber(activeCount)} />
        <StatCard
          label="Total enrolled"
          value={formatNumber(totalEnrolled)}
          hint="Contacts currently in or completed flows"
        />
        <StatCard
          label="Messages sent"
          value={formatNumber(totalMessages)}
          hint="Across all automation flows"
        />
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <CardTitle>All flows</CardTitle>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Trigger</TH>
              <TH>Enrolled</TH>
              <TH>Messages sent</TH>
              <TH>Completion rate</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
            </TR>
          </THead>
          <TBody>
            {automations.map((flow) => (
              <TR key={flow.id}>
                <TD>
                  <Link
                    href={`/automations/${flow.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {flow.name}
                  </Link>
                </TD>
                <TD className="text-muted-foreground">{flow.trigger}</TD>
                <TD>{formatNumber(flow.enrolled)}</TD>
                <TD>{formatNumber(flow.messagesSent)}</TD>
                <TD>
                  {flow.enrolled > 0 ? formatPercent(flow.completionRate) : "—"}
                </TD>
                <TD>
                  <StatusChip status={flow.status} />
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {formatUpdated(flow.updatedAt)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
