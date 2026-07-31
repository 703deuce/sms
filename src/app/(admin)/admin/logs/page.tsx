import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { Server } from "lucide-react";
import { redirect } from "next/navigation";

function levelStatus(level: string) {
  if (level === "ERROR" || level === "error" || level.includes("fail")) return "Failed";
  if (level === "WARN" || level === "warning" || level.includes("pending")) return "Pending";
  return "Delivered";
}

export default async function AdminLogsPage() {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/dashboard");

  const logs = (await getPrisma().auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { workspace: { select: { name: true } } },
  })) as Array<{
    id: string;
    event: string;
    detail: string | null;
    createdAt: Date;
    workspace: { name: string } | null;
  }>;

  const errors = logs.filter(
    (l) =>
      (l.event || "").toLowerCase().includes("fail") ||
      (l.event || "").toLowerCase().includes("error"),
  ).length;
  const warnings = logs.filter(
    (l) =>
      (l.event || "").toLowerCase().includes("warn") ||
      (l.event || "").toLowerCase().includes("pending"),
  ).length;

  return (
    <div>
      <PageHeader
        title="System logs"
        description="Platform audit events across workspaces, messaging, and compliance workers."
        actions={<Button variant="outline">Export logs</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardTitle>Events</CardTitle>
          <p className="mt-2 text-2xl font-bold">{logs.length}</p>
        </Card>
        <Card>
          <CardTitle>Errors</CardTitle>
          <p className="mt-2 text-2xl font-bold text-rose-600">{errors}</p>
        </Card>
        <Card>
          <CardTitle>Warnings</CardTitle>
          <p className="mt-2 text-2xl font-bold text-amber-600">{warnings}</p>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Recent audit events</CardTitle>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Workspace</TH>
                <TH>Event</TH>
                <TH>Detail</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {logs.map((log) => (
                <TR key={log.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </TD>
                  <TD>{log.workspace?.name || "—"}</TD>
                  <TD className="font-medium">{log.event}</TD>
                  <TD className="max-w-md truncate text-muted-foreground">
                    {log.detail || "—"}
                  </TD>
                  <TD>
                    <StatusChip status={levelStatus(log.event)} />
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
