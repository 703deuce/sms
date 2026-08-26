import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { ContactImportForm } from "@/components/contacts/contact-import-form";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadAuditLogs, loadLists } from "@/lib/workspace-data";

type AuditLogRow = Awaited<ReturnType<typeof loadAuditLogs>>[number];
type ContactListRow = Awaited<ReturnType<typeof loadLists>>[number];
import Link from "next/link";
import { contactTabs } from "@/lib/contact-tabs";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";

function formatDateTime(at: Date | string) {
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ContactImportsPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Imports" description="Upload opted-in contacts with field mapping and consent confirmation." />
        <EmptyState
          title="No workspace selected"
          description="Select or create a workspace to import contacts."
        />
      </div>
    );
  }

  const [lists, auditLogs, features]: [ContactListRow[], AuditLogRow[], Awaited<ReturnType<typeof getWorkspaceProductFeatures>>] =
    await Promise.all([
    loadLists(workspaceId),
    loadAuditLogs(workspaceId),
    getWorkspaceProductFeatures(workspaceId),
  ]);
  const marketingImport = isActiveEntitlement(features.mass_texting);
  const importHistory = auditLogs.filter((log) => log.event === "contacts.import");

  return (
    <div>
      <PageHeader
        title="Imports"
        description="Upload opted-in contacts with field mapping and consent confirmation."
        actions={
          <Link href="/contacts">
            <Button variant="outline">View all contacts</Button>
          </Link>
        }
      />

      <Tabs items={contactTabs} />

      <ContactImportForm
        lists={lists.map((l) => ({ id: l.id, name: l.name }))}
        marketingImport={marketingImport}
      />

      <Card className="mt-6">
        <CardTitle>Import history</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Detail</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {importHistory.length > 0 ? (
              importHistory.map((log) => (
                <TR key={log.id}>
                  <TD className="text-muted-foreground">
                    {formatDateTime(log.at)}
                  </TD>
                  <TD className="font-medium">{log.detail || "—"}</TD>
                  <TD>
                    <StatusChip status="Completed" />
                  </TD>
                </TR>
              ))
            ) : (
              <TR>
                <TD colSpan={3} className="text-center text-muted-foreground">
                  No imports yet
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
