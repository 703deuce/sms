import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import { Repeat } from "lucide-react";
import Link from "next/link";

const recurringCampaigns = [
  {
    id: "rec_1",
    name: "Weekly appointment reminders",
    type: "Reminder",
    audience: "Customers with upcoming visits",
    frequency: "Every Monday at 9:00 AM",
    nextRun: "2026-07-28T09:00:00Z",
    lastRun: "2026-07-21T09:00:00Z",
    status: "Active" as const,
    sentTotal: 2840,
    createdBy: "Alex Rivera",
  },
  {
    id: "rec_2",
    name: "Monthly service newsletter",
    type: "Promotion",
    audience: "All subscribed",
    frequency: "1st of each month at 10:00 AM",
    nextRun: "2026-08-01T10:00:00Z",
    lastRun: "2026-07-01T10:00:00Z",
    status: "Active" as const,
    sentTotal: 6120,
    createdBy: "Sam Patel",
  },
  {
    id: "rec_3",
    name: "Birthday greetings",
    type: "Announcement",
    audience: "Birthday segment",
    frequency: "Daily at 8:00 AM",
    nextRun: "2026-07-28T08:00:00Z",
    lastRun: "2026-07-27T08:00:00Z",
    status: "Active" as const,
    sentTotal: 412,
    createdBy: "Sam Patel",
  },
  {
    id: "rec_4",
    name: "Quarterly NPS survey",
    type: "Survey",
    audience: "VIP",
    frequency: "Every 90 days",
    nextRun: "2026-10-01T11:00:00Z",
    lastRun: "2026-07-03T11:00:00Z",
    status: "Paused" as const,
    sentTotal: 176,
    createdBy: "Casey Nguyen",
  },
  {
    id: "rec_5",
    name: "End-of-day dispatch updates",
    type: "Alert",
    audience: "Employees",
    frequency: "Weekdays at 4:30 PM",
    nextRun: "2026-07-28T16:30:00Z",
    lastRun: "2026-07-25T16:30:00Z",
    status: "Active" as const,
    sentTotal: 960,
    createdBy: "Alex Rivera",
  },
];

function formatDateTime(at: string) {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CampaignRecurringPage() {
  const activeCount = recurringCampaigns.filter((c) => c.status === "Active").length;

  return (
    <div>
      <PageHeader
        title="Recurring campaigns"
        description="Automated sends that repeat on a schedule. Each run uses current audience membership and compliance settings."
        actions={
          <>
            <Link href="/campaigns">
              <Button variant="outline">All campaigns</Button>
            </Link>
            <Link href="/send">
              <Button>Create recurring</Button>
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recurring flows
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {recurringCampaigns.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{activeCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Messages sent (lifetime)
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {formatNumber(recurringCampaigns.reduce((sum, c) => sum + c.sentTotal, 0))}
          </p>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          <CardTitle>Recurring schedule</CardTitle>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Audience</TH>
              <TH>Frequency</TH>
              <TH>Next run</TH>
              <TH>Last run</TH>
              <TH>Status</TH>
              <TH>Total sent</TH>
              <TH>Created by</TH>
            </TR>
          </THead>
          <TBody>
            {recurringCampaigns.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.name}</TD>
                <TD className="text-muted-foreground">{c.type}</TD>
                <TD className="text-muted-foreground">{c.audience}</TD>
                <TD className="whitespace-nowrap">{c.frequency}</TD>
                <TD className="whitespace-nowrap font-medium">
                  {formatDateTime(c.nextRun)}
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(c.lastRun)}
                </TD>
                <TD>
                  <StatusChip status={c.status} />
                </TD>
                <TD>{formatNumber(c.sentTotal)}</TD>
                <TD className="text-muted-foreground">{c.createdBy}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardTitle>How recurring campaigns work</CardTitle>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>Audience is re-evaluated before each run — new subscribers are included automatically.</li>
          <li>Quiet hours and A2P limits apply to every scheduled occurrence.</li>
          <li>Paused flows retain their schedule but skip runs until reactivated.</li>
          <li>Each run creates a child campaign record visible under Completed or Failed.</li>
        </ul>
      </Card>
    </div>
  );
}
