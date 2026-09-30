import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { titleCaseStatus } from "@/lib/mappers";
import { loadAdminRegistrations } from "@/lib/admin-data";
import { listMctbOwnSenderA2pSubmissionsForAdmin } from "@/lib/mctb/own-sender-a2p-intake";
import Link from "next/link";

export default async function AdminA2pPage() {
  const [registrations, mctbOwnSenderIntakes] = await Promise.all([
    loadAdminRegistrations(),
    listMctbOwnSenderA2pSubmissionsForAdmin(),
  ]);

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

      <Card className="mb-6">
        <CardTitle>MCTB Own Local Number intake ({mctbOwnSenderIntakes.length})</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Customer-submitted A2P details from the Own Local Number add-on wizard. Submit these to the
          carrier manually.
        </p>
        {mctbOwnSenderIntakes.length === 0 ? (
          <EmptyState
            title="No MCTB own-number submissions"
            description="Submissions appear when a customer completes the Own Local Number A2P form."
          />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Legal business</TH>
                <TH>Contact</TH>
                <TH>Submitted</TH>
              </TR>
            </THead>
            <TBody>
              {mctbOwnSenderIntakes.map((row) => (
                <TR key={row.workspaceId}>
                  <TD>
                    <Link
                      href={`/admin/customers/${row.workspaceId}`}
                      className="font-medium hover:text-primary"
                    >
                      {row.workspaceName}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{row.intake.legalBusinessName || "—"}</TD>
                  <TD className="text-muted-foreground">{row.intake.contactEmail || "—"}</TD>
                  <TD className="text-muted-foreground">
                    {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

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
