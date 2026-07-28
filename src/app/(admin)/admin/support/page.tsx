import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const supportTickets = [
  {
    id: "tkt_1",
    subject: "A2P brand rejected — need guidance",
    customer: "QuickMove Logistics",
    priority: "High" as const,
    status: "Open" as const,
    assignee: "Support Team",
    created: "2026-07-26T10:00:00Z",
    updated: "2026-07-27T09:15:00Z",
  },
  {
    id: "tkt_2",
    subject: "Unable to send campaign — delivery blocked",
    customer: "Harbor Home Services",
    priority: "Medium" as const,
    status: "Pending" as const,
    assignee: "Jordan (Support)",
    created: "2026-07-25T14:30:00Z",
    updated: "2026-07-26T11:00:00Z",
  },
  {
    id: "tkt_3",
    subject: "Billing question — usage overage",
    customer: "BrightPath Dental",
    priority: "Low" as const,
    status: "Open" as const,
    assignee: "Unassigned",
    created: "2026-07-24T16:45:00Z",
    updated: "2026-07-24T16:45:00Z",
  },
  {
    id: "tkt_4",
    subject: "API webhook delivery failures",
    customer: "BrightPath Dental",
    priority: "Medium" as const,
    status: "Closed" as const,
    assignee: "Dev Support",
    created: "2026-07-20T08:00:00Z",
    updated: "2026-07-22T17:30:00Z",
  },
  {
    id: "tkt_5",
    subject: "Request to port toll-free number",
    customer: "Metro Auto Sales",
    priority: "Low" as const,
    status: "Pending" as const,
    assignee: "Numbers Team",
    created: "2026-07-23T12:00:00Z",
    updated: "2026-07-25T10:00:00Z",
  },
];

export default function AdminSupportPage() {
  const open = supportTickets.filter((t) => t.status === "Open").length;
  const pending = supportTickets.filter((t) => t.status === "Pending").length;
  const highPriority = supportTickets.filter((t) => t.priority === "High").length;

  return (
    <div>
      <PageHeader
        title="Support"
        description="Customer support tickets across billing, compliance, and technical issues."
        actions={<Button>New ticket</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Open tickets" value={open} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="High priority" value={highPriority} />
      </div>

      <Card>
        <CardTitle>All tickets</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Subject</TH>
              <TH>Customer</TH>
              <TH>Priority</TH>
              <TH>Status</TH>
              <TH>Assignee</TH>
              <TH>Created</TH>
              <TH>Updated</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {supportTickets.map((ticket) => (
              <TR key={ticket.id}>
                <TD className="max-w-[240px] font-medium">{ticket.subject}</TD>
                <TD>{ticket.customer}</TD>
                <TD>
                  <StatusChip status={ticket.priority} />
                </TD>
                <TD>
                  <StatusChip status={ticket.status} />
                </TD>
                <TD className="text-muted-foreground">{ticket.assignee}</TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {new Date(ticket.created).toLocaleDateString()}
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {new Date(ticket.updated).toLocaleDateString()}
                </TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
