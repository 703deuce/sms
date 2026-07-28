import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { adminCustomers, phoneNumbers } from "@/lib/mock/data";
import { formatCurrency, formatNumber, formatPhone } from "@/lib/utils";

const platformNumbers = [
  ...phoneNumbers.map((pn) => ({
    id: pn.id,
    number: pn.number,
    customer: "Harbor Home Services",
    customerId: "ac_1",
    type: pn.type,
    a2pStatus: pn.a2pStatus,
    monthlyCost: pn.monthlyCost,
    status: pn.status,
  })),
  {
    id: "pn_3",
    number: "+14155550999",
    customer: "BrightPath Dental",
    customerId: "ac_2",
    type: "Local" as const,
    a2pStatus: "Approved" as const,
    monthlyCost: 1.15,
    status: "Active" as const,
  },
  {
    id: "pn_4",
    number: "+18005550888",
    customer: "QuickMove Logistics",
    customerId: "ac_3",
    type: "Toll-free" as const,
    a2pStatus: "Rejected" as const,
    monthlyCost: 2.15,
    status: "Active" as const,
  },
];

export default function AdminNumbersPage() {
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
                <TD>{num.customer}</TD>
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
        <p className="mt-4 text-xs text-muted-foreground">
          {adminCustomers.length} customer accounts on platform.
        </p>
      </Card>
    </div>
  );
}
