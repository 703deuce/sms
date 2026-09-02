import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadAdminCustomers, loadAdminUsageTotals } from "@/lib/admin-data";
import { loadSmsWorkerHealth } from "@/lib/messaging/dispatch/worker-health";
import { formatNumber, formatPercent } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function AdminMonitoringPage() {
  const [adminCustomers, usageTotals, smsWorker] = await Promise.all([
    loadAdminCustomers(),
    loadAdminUsageTotals(),
    loadSmsWorkerHealth(),
  ]);

  const highVolumeAccounts = adminCustomers
    .filter((c) => c.messages > 1000)
    .map((c) => ({
      customer: c.name,
      customerId: c.id,
      messages: c.messages,
      status: c.messages > 5000 ? "High" as const : "Medium" as const,
    }));

  const highRiskAccounts = adminCustomers.filter((c) => c.risk === "High" || c.risk === "Medium");

  return (
    <div>
      <PageHeader
        title="Platform monitoring"
        description="Volume thresholds, failure rates, and compliance risk across accounts."
        actions={<Button variant="outline">Configure alerts</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Message volume" value={formatNumber(usageTotals.messageVolume)} />
        <StatCard label="Failure rate" value={formatPercent(usageTotals.failureRate)} />
        <StatCard label="High-volume accounts" value={formatNumber(highVolumeAccounts.length)} />
        <StatCard label="Elevated risk" value={formatNumber(highRiskAccounts.length)} />
      </div>

      <Card className="mb-6">
        <CardTitle>SMS dispatch worker</CardTitle>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <StatusChip status={smsWorker.healthy ? "Healthy" : "Unhealthy"} />
          <span className="text-muted-foreground">
            Last heartbeat:{" "}
            {smsWorker.ageSeconds != null
              ? `${smsWorker.ageSeconds} second${smsWorker.ageSeconds === 1 ? "" : "s"} ago`
              : smsWorker.tableMissing
                ? "table missing — run migration"
                : "never recorded"}
          </span>
          {smsWorker.workerId ? (
            <span className="text-muted-foreground">Worker ID: {smsWorker.workerId}</span>
          ) : null}
          <span className="text-muted-foreground">
            Due messages: {formatNumber(smsWorker.metrics.dueCount ?? 0)} · Queued jobs:{" "}
            {formatNumber(smsWorker.metrics.queuedCount ?? 0)}
          </span>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <CardTitle>High volume accounts</CardTitle>
          </div>
          {highVolumeAccounts.length === 0 ? (
            <EmptyState title="No high-volume accounts" description="Accounts above 1,000 messages appear here." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH>Messages</TH>
                  <TH>Level</TH>
                </TR>
              </THead>
              <TBody>
                {highVolumeAccounts.map((row) => (
                  <TR key={row.customerId}>
                    <TD>
                      <Link href={`/admin/customers/${row.customerId}`} className="font-medium hover:text-primary">
                        {row.customer}
                      </Link>
                    </TD>
                    <TD>{formatNumber(row.messages)}</TD>
                    <TD>
                      <StatusChip status={row.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardTitle>Risk & compliance</CardTitle>
          {highRiskAccounts.length === 0 ? (
            <EmptyState title="No elevated risk" description="All workspaces are within normal thresholds." />
          ) : (
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH>A2P</TH>
                  <TH>Risk</TH>
                  <TH>Messages</TH>
                </TR>
              </THead>
              <TBody>
                {highRiskAccounts.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/admin/customers/${c.id}`} className="font-medium hover:text-primary">
                        {c.name}
                      </Link>
                    </TD>
                    <TD>
                      <StatusChip status={c.a2p} />
                    </TD>
                    <TD>
                      <StatusChip status={c.risk} />
                    </TD>
                    <TD>{formatNumber(c.messages)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
