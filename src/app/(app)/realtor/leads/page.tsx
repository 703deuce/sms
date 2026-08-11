import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadRealtorLeads } from "@/lib/realtor/dashboard";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";

export default async function RealtorLeadsPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const leads = await loadRealtorLeads(workspaceId);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Leads" description="Every conversation flows back to a lead record." />
      <div className="flex gap-2">
        <Link href="/realtor/needs-attention" className="inline-flex h-8 items-center rounded-md border px-3 text-xs">
          Needs Attention
        </Link>
        <Link href="/realtor/leads/sources" className="inline-flex h-8 items-center rounded-md border px-3 text-xs">
          Lead Sources
        </Link>
        <Link href="/realtor/test" className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground">
          Add Test Lead
        </Link>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Phone</TH>
              <TH>Status</TH>
              <TH>Intent</TH>
              <TH>Source</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {leads.map((lead) => (
              <TR key={lead.id}>
                <TD className="font-medium">{lead.name}</TD>
                <TD>{formatPhone(lead.phone)}</TD>
                <TD>
                  <StatusChip status={lead.status} />
                </TD>
                <TD>{lead.intent || "—"}</TD>
                <TD>{lead.source || "—"}</TD>
                <TD>
                  <Link href={`/realtor/leads/${lead.id}`} className="text-sm font-medium text-primary">
                    Open
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
