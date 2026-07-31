import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadAdminCustomers, loadAdminPhoneNumbers } from "@/lib/admin-data";
import { formatCurrency, formatNumber, formatPhone } from "@/lib/utils";
import Link from "next/link";

export default async function AdminNumbersPage() {
  const [platformNumbers, customers] = await Promise.all([
    loadAdminPhoneNumbers(),
    loadAdminCustomers(),
  ]);

  const active = platformNumbers.filter((n) => n.status === "Active").length;
  const pendingA2p = platformNumbers.filter((n) => n.a2pStatus === "Pending").length;
  const monthlyCost = platformNumbers.reduce((sum, n) => sum + n.monthlyCost, 0);

  return (
    <div>
      <PageHeader
        title="Platform numbers"
        description="Phone number inventory across all customer accounts."
        actions={<Button variant="outline">Provision number</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total numbers" value={formatNumber(platformNumbers.length)} />
        <StatCard label="Active" value={formatNumber(active)} />
        <StatCard label="Pending A2P" value={formatNumber(pendingA2p)} />
        <StatCard label="Monthly Twilio cost" value={formatCurrency(monthlyCost)} />
      </div>

      <Card>
        <CardTitle>Number inventory</CardTitle>
        {platformNumbers.length === 0 ? (
          <EmptyState title="No phone numbers" description="Provisioned numbers will appear here." />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Number</TH>
                <TH>Customer</TH>
                <TH>Type</TH>
                <TH>A2P status</TH>
                <TH>Monthly cost</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {platformNumbers.map((num) => (
                <TR key={num.id}>
                  <TD className="font-medium">{formatPhone(num.number)}</TD>
                  <TD>
                    <Link href={`/admin/customers/${num.customerId}`} className="hover:text-primary">
                      {num.customer}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{num.type}</TD>
                  <TD>
                    <StatusChip status={num.a2pStatus} />
                  </TD>
                  <TD>{formatCurrency(num.monthlyCost)}</TD>
                  <TD>
                    <StatusChip status={num.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          {customers.length} customer account{customers.length === 1 ? "" : "s"} on platform.
        </p>
      </Card>
    </div>
  );
}
