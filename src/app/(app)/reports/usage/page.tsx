import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import {
  loadCampaigns,
  loadDashboardMetrics,
  loadPhoneNumbers,
  loadTeamMembers,
  loadUsage,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { formatCurrency, formatNumber, formatPhone } from "@/lib/utils";
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

export default async function ReportsUsagePage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [metrics, usage, campaigns, phoneNumbers, teamMembers] = await Promise.all([
    loadDashboardMetrics(workspaceId),
    loadUsage(workspaceId),
    loadCampaigns(workspaceId),
    loadPhoneNumbers(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  const currentUsage = usage[0];
  const smsSegments = currentUsage?.smsSegments ?? campaigns.reduce((s, c) => s + c.sent, 0);
  const mmsCount = currentUsage?.mmsMessages ?? 0;
  const outbound = currentUsage?.outbound ?? metrics.messagesSentPeriod;
  const inbound = currentUsage?.inbound ?? 0;
  const totalCost = (currentUsage?.costCents ?? 0) / 100 || campaigns.reduce((s, c) => s + c.cost, 0);

  const usageByCampaign = campaigns.filter((c) => c.sent > 0);

  return (
    <div>
      <PageHeader
        title="Usage & cost"
        description="SMS segments, MMS, inbound/outbound volume, and cost breakdown by user, number, and campaign."
        actions={
          <Link href="/settings/billing">
            <Button variant="outline">View billing</Button>
          </Link>
        }
      />

      <Tabs items={reportTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="SMS segments" value={formatNumber(smsSegments)} />
        <StatCard label="MMS messages" value={formatNumber(mmsCount)} />
        <StatCard label="Outbound" value={formatNumber(outbound)} />
        <StatCard label="Inbound" value={formatNumber(inbound)} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Period cost" value={formatCurrency(totalCost)} />
        <StatCard label="Credits remaining" value={formatNumber(metrics.creditsRemaining)} />
        <StatCard label="Account balance" value={formatCurrency(metrics.balance)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Team members</CardTitle>
          {teamMembers.length === 0 ? (
            <EmptyState title="No team members" description="Invite users to track per-user usage." />
          ) : (
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Role</TH>
                </TR>
              </THead>
              <TBody>
                {teamMembers.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-medium">{m.name}</TD>
                    <TD className="text-muted-foreground">{m.role}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardTitle>Usage by number</CardTitle>
          {phoneNumbers.length === 0 ? (
            <EmptyState title="No phone numbers" description="Provision a number to start sending." />
          ) : (
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Number</TH>
                  <TH>Name</TH>
                  <TH>Monthly cost</TH>
                </TR>
              </THead>
              <TBody>
                {phoneNumbers.map((row) => (
                  <TR key={row.id}>
                    <TD>{formatPhone(row.number)}</TD>
                    <TD className="font-medium">{row.friendlyName}</TD>
                    <TD>{formatCurrency(row.monthlyCost)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Usage by campaign</CardTitle>
        {usageByCampaign.length === 0 ? (
          <EmptyState title="No campaign usage" description="Send campaigns to see usage breakdown." />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Campaign</TH>
                <TH>Sent</TH>
                <TH>Segments (est.)</TH>
                <TH>Cost</TH>
              </TR>
            </THead>
            <TBody>
              {usageByCampaign.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium">{c.name}</TD>
                  <TD>{formatNumber(c.sent)}</TD>
                  <TD>{formatNumber(c.sent)}</TD>
                  <TD>{formatCurrency(c.cost)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {usage.length > 0 ? (
        <Card className="mt-4">
          <CardTitle>Usage history</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Period</TH>
                <TH>Outbound</TH>
                <TH>Inbound</TH>
                <TH>Segments</TH>
                <TH>Cost</TH>
              </TR>
            </THead>
            <TBody>
              {usage.map((row) => (
                <TR key={row.id}>
                  <TD className="text-muted-foreground">
                    {new Date(row.periodStart).toLocaleDateString()} – {new Date(row.periodEnd).toLocaleDateString()}
                  </TD>
                  <TD>{formatNumber(row.outbound)}</TD>
                  <TD>{formatNumber(row.inbound)}</TD>
                  <TD>{formatNumber(row.smsSegments)}</TD>
                  <TD>{formatCurrency(row.costCents / 100)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
