import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { automations } from "@/lib/mock/data";
import { formatNumber, formatPercent } from "@/lib/utils";
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

const stepPerformance = [
  { flow: "Welcome series", step: "Day 0 — Welcome", sent: 842, completed: 798, dropOff: 5.2 },
  { flow: "Welcome series", step: "Day 2 — Tips", sent: 712, completed: 656, dropOff: 7.9 },
  { flow: "Welcome series", step: "Day 5 — Offer", sent: 580, completed: 452, dropOff: 22.1 },
  { flow: "Missed-call text-back", step: "Immediate reply", sent: 120, completed: 110, dropOff: 8.3 },
  { flow: "No-response follow-up", step: "48h nudge", sent: 54, completed: 22, dropOff: 59.3 },
];

export default function ReportsAutomationsPage() {
  const activeFlows = automations.filter((a) => a.status === "Active").length;
  const totalEnrolled = automations.reduce((sum, a) => sum + a.enrolled, 0);
  const totalMessages = automations.reduce((sum, a) => sum + a.messagesSent, 0);
  const activeWithRate = automations.filter((a) => a.enrolled > 0);
  const avgCompletion =
    activeWithRate.length > 0
      ? activeWithRate.reduce((sum, a) => sum + a.completionRate, 0) / activeWithRate.length
      : 0;

  return (
    <div>
      <PageHeader
        title="Automation reports"
        description="Flow enrollments, completion rates, and step-level performance across SMS automations."
        actions={
          <Link href="/automations">
            <Button variant="outline">View flows</Button>
          </Link>
        }
      />

      <Tabs items={reportTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active flows" value={formatNumber(activeFlows)} />
        <StatCard label="Total enrolled" value={formatNumber(totalEnrolled)} />
        <StatCard label="Messages sent" value={formatNumber(totalMessages)} />
        <StatCard label="Avg completion" value={formatPercent(avgCompletion)} />
      </div>

      <Card>
        <CardTitle>Flow performance</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Flow</TH>
              <TH>Trigger</TH>
              <TH>Enrolled</TH>
              <TH>Messages sent</TH>
              <TH>Completion rate</TH>
              <TH>Status</TH>
              <TH>Last updated</TH>
            </TR>
          </THead>
          <TBody>
            {automations.map((flow) => (
              <TR key={flow.id}>
                <TD className="font-medium">{flow.name}</TD>
                <TD className="text-muted-foreground">{flow.trigger}</TD>
                <TD>{formatNumber(flow.enrolled)}</TD>
                <TD>{formatNumber(flow.messagesSent)}</TD>
                <TD>{flow.enrolled > 0 ? formatPercent(flow.completionRate) : "—"}</TD>
                <TD>
                  <StatusChip status={flow.status} />
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {new Date(flow.updatedAt).toLocaleDateString()}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card className="mt-4">
        <CardTitle>Step performance</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Flow</TH>
              <TH>Step</TH>
              <TH>Sent</TH>
              <TH>Completed</TH>
              <TH>Drop-off</TH>
            </TR>
          </THead>
          <TBody>
            {stepPerformance.map((step, i) => (
              <TR key={i}>
                <TD className="font-medium">{step.flow}</TD>
                <TD>{step.step}</TD>
                <TD>{formatNumber(step.sent)}</TD>
                <TD>{formatNumber(step.completed)}</TD>
                <TD>{formatPercent(step.dropOff)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
