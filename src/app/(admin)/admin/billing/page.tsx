import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadAdminCustomers, loadAdminUsageTotals } from "@/lib/admin-data";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function AdminBillingPage() {
  const [adminCustomers, usageTotals] = await Promise.all([
    loadAdminCustomers(),
    loadAdminUsageTotals(),
  ]);

  const mrr = adminCustomers.reduce((sum, c) => sum + c.mrr, 0);

  const usageCharges = adminCustomers
    .filter((c) => c.messages > 0)
    .map((c) => ({
      customer: c.name,
      customerId: c.id,
      messages: c.messages,
      segments: Math.round(c.messages * 1.04),
      revenue: c.messages * 0.015,
      telnyxCost: c.messages * 0.0085,
      margin: c.messages * 0.0065,
    }));

  return (
    <div>
      <PageHeader
        title="Platform billing"
        description="Subscription revenue, usage charges, and margin across all accounts."
        actions={<Button variant="outline">Export report</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR" value={formatCurrency(mrr)} />
        <StatCard label="Usage revenue" value={formatCurrency(usageTotals.revenue)} />
        <StatCard label="Telnyx cost" value={formatCurrency(usageTotals.telnyxCost)} />
        <StatCard label="Message volume" value={formatNumber(usageTotals.messageVolume)} />
      </div>

      <Card>
        <CardTitle>Subscription accounts</CardTitle>
        {adminCustomers.length === 0 ? (
          <EmptyState title="No accounts" description="Billing data will appear as workspaces are created." />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Plan</TH>
                <TH>Status</TH>
                <TH>MRR</TH>
                <TH>Messages</TH>
              </TR>
            </THead>
            <TBody>
              {adminCustomers.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium">{c.name}</TD>
                  <TD>{c.plan}</TD>
                  <TD>
                    <StatusChip status={c.status} />
                  </TD>
                  <TD>{formatCurrency(c.mrr)}</TD>
                  <TD>{formatNumber(c.messages)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardTitle>Usage charges by workspace</CardTitle>
        {usageCharges.length === 0 ? (
          <EmptyState title="No usage" description="Usage charges appear after messaging activity." />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Messages</TH>
                <TH>Segments (est.)</TH>
                <TH>Revenue</TH>
                <TH>Telnyx cost</TH>
                <TH>Margin</TH>
              </TR>
            </THead>
            <TBody>
              {usageCharges.map((row) => (
                <TR key={row.customerId}>
                  <TD className="font-medium">{row.customer}</TD>
                  <TD>{formatNumber(row.messages)}</TD>
                  <TD>{formatNumber(row.segments)}</TD>
                  <TD>{formatCurrency(row.revenue)}</TD>
                  <TD>{formatCurrency(row.telnyxCost)}</TD>
                  <TD>{formatCurrency(row.margin)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
