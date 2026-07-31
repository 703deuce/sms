import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { titleCaseStatus } from "@/lib/mappers";
import { loadAdminRegistrations } from "@/lib/admin-data";
import Link from "next/link";

export default async function AdminA2pPage() {
  const registrations = await loadAdminRegistrations();

  const pendingBrands = registrations.filter(
    (r) => ["pending", "in_review", "submitted"].includes((r.brandStatus || "").toLowerCase()),
  );
  const pendingCampaigns = registrations.filter(
    (r) =>
      ["draft", "pending", "in_review", "submitted", "rejected", "failed"].includes(
        (r.campaignStatus || "").toLowerCase(),
      ),
  );

  return (
    <div>
      <PageHeader
        title="A2P registration queue"
        description="Brand and campaign registrations across all customer workspaces."
        actions={<Button variant="outline">Export queue</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Pending brands ({pendingBrands.length})</CardTitle>
          {pendingBrands.length === 0 ? (
            <EmptyState title="No pending brands" description="Brand submissions will appear here." />
          ) : (
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH>Business</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {pendingBrands.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/admin/customers/${r.workspace.id}`} className="font-medium hover:text-primary">
                        {r.workspace.name}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">{r.legalBusinessName || "—"}</TD>
                    <TD>
                      <StatusChip status={titleCaseStatus(r.brandStatus)} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardTitle>Campaign registrations ({pendingCampaigns.length})</CardTitle>
          {pendingCampaigns.length === 0 ? (
            <EmptyState title="No campaign registrations" description="Campaign submissions will appear here." />
          ) : (
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH>Use case</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {pendingCampaigns.map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/admin/customers/${r.workspace.id}`} className="font-medium hover:text-primary">
                        {r.workspace.name}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">{r.useCase || "—"}</TD>
                    <TD>
                      <StatusChip status={titleCaseStatus(r.campaignStatus)} />
                    </TD>
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
