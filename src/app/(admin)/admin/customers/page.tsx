import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadAdminCustomers } from "@/lib/admin-data";
import { formatCurrency, formatNumber } from "@/lib/utils";
import Link from "next/link";

export default async function AdminCustomersPage() {
  const adminCustomers = await loadAdminCustomers();

  return (
    <div>
      <PageHeader
        title="Customers"
        description="All platform accounts with plan, billing status, message volume, and compliance state."
        actions={<Button variant="outline">Export CSV</Button>}
      />

      <Card>
        <CardTitle>All customers</CardTitle>
        {adminCustomers.length === 0 ? (
          <EmptyState title="No workspaces" description="No customer workspaces on the platform yet." />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Plan</TH>
                <TH>Status</TH>
                <TH>MRR</TH>
                <TH>Messages</TH>
                <TH>A2P</TH>
                <TH>Risk</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {adminCustomers.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.name}
                    </Link>
                  </TD>
                  <TD>{c.plan}</TD>
                  <TD>
                    <StatusChip status={c.status} />
                  </TD>
                  <TD>{formatCurrency(c.mrr)}</TD>
                  <TD>{formatNumber(c.messages)}</TD>
                  <TD>
                    <StatusChip status={c.a2p} />
                  </TD>
                  <TD>
                    <StatusChip status={c.risk} />
                  </TD>
                  <TD className="text-right">
                    <Link href={`/admin/customers/${c.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
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
