import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import {
  loadConversations,
  loadDashboardMetrics,
  loadTeamMembers,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { formatNumber, formatPercent, formatPhone } from "@/lib/utils";
import Link from "next/link";

const reportTabs = [
  { label: "Overview", href: "/reports" },
  { label: "Campaigns", href: "/reports/campaigns" },
  { label: "Messages", href: "/reports/messages" },
  { label: "Contacts", href: "/reports/contacts" },
  { label: "Inbox", href: "/reports/inbox" },
  { label: "Automations", href: "/reports/automations" },
  { label: "Links", href: "/reports/links" },
  { label: "Usage", href: "/reports/usage" },
  { label: "Audit log", href: "/reports/audit-log" },
];

export default async function ReportsInboxPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [metrics, conversations, teamMembers] = await Promise.all([
    loadDashboardMetrics(workspaceId),
    loadConversations(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  const open = conversations.filter((c) => c.status === "Open").length;
  const unread = conversations.filter((c) => c.unread).length;
  const unassigned = conversations.filter((c) => !c.assignedTo).length;

  return (
    <div>
      <PageHeader
        title="Inbox reports"
        description="Team response metrics, conversation volume, and assignment workload."
        actions={
          <Link href="/inbox" className="text-sm font-medium text-primary hover:underline">
            Open inbox
          </Link>
        }
      />

      <Tabs items={reportTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reply rate" value={formatPercent(metrics.replyRate)} />
        <StatCard label="Open conversations" value={formatNumber(open)} />
        <StatCard label="Unread" value={formatNumber(unread)} />
        <StatCard label="Unassigned" value={formatNumber(unassigned)} />
      </div>

      <Card>
        <CardTitle>Recent conversations</CardTitle>
        {conversations.length === 0 ? (
          <EmptyState title="No conversations" description="Inbox activity will appear here." />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Contact</TH>
                <TH>Phone</TH>
                <TH>Assigned to</TH>
                <TH>Status</TH>
                <TH>Last message</TH>
                <TH>Updated</TH>
              </TR>
            </THead>
            <TBody>
              {conversations.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium">
                    {c.contactName}
                    {c.unread ? (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary" />
                    ) : null}
                  </TD>
                  <TD>{formatPhone(c.phone)}</TD>
                  <TD className="text-muted-foreground">{c.assignedTo ?? "Unassigned"}</TD>
                  <TD>
                    <StatusChip status={c.status} />
                  </TD>
                  <TD className="max-w-[240px] truncate text-muted-foreground">{c.lastMessage}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Agent workload</CardTitle>
        {teamMembers.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No team members.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {teamMembers
              .filter((m) => m.role === "Inbox agent" || m.role === "Owner")
              .map((m) => {
                const assigned = conversations.filter((c) => c.assignedTo === m.name).length;
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm"
                  >
                    <span>{m.name}</span>
                    <span className="text-muted-foreground">{assigned} assigned</span>
                  </li>
                );
              })}
          </ul>
        )}
      </Card>
    </div>
  );
}
