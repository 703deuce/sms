import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { adminCustomers } from "@/lib/mock/data";
import Link from "next/link";

const pendingBrands = [
  {
    id: "br_1",
    customer: "Harbor Home Services",
    customerId: "ac_1",
    brand: "Harbor Home Services LLC",
    submitted: "2026-07-18",
    status: "Pending" as const,
  },
  {
    id: "br_2",
    customer: "Sunrise Fitness",
    customerId: "ac_4",
    brand: "Sunrise Fitness Co",
    submitted: "2026-07-22",
    status: "Pending" as const,
  },
];

const pendingCampaigns = [
  {
    id: "cp_1",
    customer: "Harbor Home Services",
    customerId: "ac_1",
    campaign: "Marketing — Service reminders",
    useCase: "Mixed",
    submitted: "2026-07-20",
    status: "Draft" as const,
  },
  {
    id: "cp_2",
    customer: "QuickMove Logistics",
    customerId: "ac_3",
    campaign: "Delivery notifications",
    useCase: "Delivery",
    submitted: "2026-07-15",
    status: "Rejected" as const,
  },
  {
    id: "cp_3",
    customer: "BrightPath Dental",
    customerId: "ac_2",
    campaign: "Appointment reminders",
    useCase: "Customer care",
    submitted: "2026-07-10",
    status: "Pending" as const,
  },
];

export default function AdminA2pPage() {
  const pendingFromCustomers = adminCustomers.filter(
    (c) => c.a2p === "Pending" || c.a2p === "Rejected",
  );

  return (
    <div>
      <PageHeader
        title="A2P registrations"
        description="Review pending brand and campaign registrations in the 10DLC queue."
        actions={<Button variant="outline">Export queue</Button>}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {pendingFromCustomers.map((c) => (
          <Link
            key={c.id}
            href={`/admin/customers/${c.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/30"
          >
            {c.name}
            <StatusChip status={c.a2p} />
          </Link>
        ))}
      </div>

      <Card className="mb-4">
        <CardTitle>Pending brands</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Customer</TH>
              <TH>Brand name</TH>
              <TH>Submitted</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {pendingBrands.map((brand) => (
              <TR key={brand.id}>
                <TD>
                  <Link
                    href={`/admin/customers/${brand.customerId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {brand.customer}
                  </Link>
                </TD>
                <TD>{brand.brand}</TD>
                <TD className="text-muted-foreground">
                  {new Date(brand.submitted).toLocaleDateString()}
                </TD>
                <TD>
                  <StatusChip status={brand.status} />
                </TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    Review
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardTitle>Pending campaigns</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Customer</TH>
              <TH>Campaign</TH>
              <TH>Use case</TH>
              <TH>Submitted</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {pendingCampaigns.map((campaign) => (
              <TR key={campaign.id}>
                <TD>
                  <Link
                    href={`/admin/customers/${campaign.customerId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {campaign.customer}
                  </Link>
                </TD>
                <TD>{campaign.campaign}</TD>
                <TD className="text-muted-foreground">{campaign.useCase}</TD>
                <TD className="text-muted-foreground">
                  {new Date(campaign.submitted).toLocaleDateString()}
                </TD>
                <TD>
                  <StatusChip status={campaign.status} />
                </TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    Review
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
