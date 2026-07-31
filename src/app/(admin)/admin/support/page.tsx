import { SupportTicketsPanel, type SupportTicketRow } from "@/components/admin/support-tickets-panel";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadAdminAuditLogs } from "@/lib/admin-data";
import { getPrisma } from "@/lib/db";

export default async function AdminSupportPage() {
  const [auditEntries, ticketRows] = await Promise.all([
    loadAdminAuditLogs(50),
    getPrisma()
      .supportTicket.findMany({ orderBy: { createdAt: "desc" }, take: 200 })
      .catch(() => [] as Array<Record<string, unknown>>),
  ]);

  const tickets: SupportTicketRow[] = (ticketRows as Array<Record<string, unknown>>).map((t) => ({
    id: String(t.id),
    email: String(t.email || ""),
    subject: String(t.subject || ""),
    body: String(t.body || ""),
    status: String(t.status || "open"),
    workspaceId: (t.workspaceId as string | null) ?? null,
    createdAt: new Date(t.createdAt as string).toISOString(),
  }));

  const openTickets = tickets.filter((t) => t.status !== "closed").length;
  const pending = auditEntries.filter((e) =>
    e.event.toLowerCase().includes("pending") || e.event.toLowerCase().includes("review"),
  ).length;
  const highPriority = auditEntries.filter((e) =>
    e.event.toLowerCase().includes("reject") || e.event.toLowerCase().includes("failed"),
  ).length;

  return (
    <div>
      <PageHeader
        title="Support"
        description="Customer support tickets across billing, compliance, and technical issues."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Open tickets" value={openTickets} />
        <StatCard label="Pending review" value={pending} />
        <StatCard label="Needs attention" value={highPriority} />
      </div>

      <SupportTicketsPanel initialTickets={tickets} />

      <Card>
        <CardTitle>Recent account events</CardTitle>
        {auditEntries.length === 0 ? (
          <EmptyState
            title="No support items"
            description="Account audit events and support requests will appear here."
          />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Event</TH>
                <TH>Workspace</TH>
                <TH>Actor</TH>
                <TH>Detail</TH>
                <TH>Time</TH>
              </TR>
            </THead>
            <TBody>
              {auditEntries.map((entry) => (
                <TR key={entry.id}>
                  <TD className="max-w-[240px] font-medium">{entry.event}</TD>
                  <TD>{entry.workspaceName}</TD>
                  <TD className="text-muted-foreground">{entry.actor}</TD>
                  <TD className="max-w-[280px] truncate text-muted-foreground">{entry.detail}</TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {new Date(entry.at).toLocaleString()}
                  </TD>
                  <TD className="text-right">
                    <StatusChip
                      status={
                        entry.event.toLowerCase().includes("failed") ||
                        entry.event.toLowerCase().includes("reject")
                          ? "Failed"
                          : "Open"
                      }
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
