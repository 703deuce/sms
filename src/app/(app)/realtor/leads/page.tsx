import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadRealtorLeads } from "@/lib/realtor/dashboard";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import { REALTOR_PIPELINE_COLUMNS } from "@/lib/realtor/nav";
import type { RealtorLeadRow, RealtorLeadStatus } from "@/lib/realtor/types";
import { cn, formatPhone } from "@/lib/utils";
import Link from "next/link";

function groupByStatus(leads: RealtorLeadRow[]): Record<RealtorLeadStatus, RealtorLeadRow[]> {
  const grouped = Object.fromEntries(
    REALTOR_PIPELINE_COLUMNS.map((c) => [c.status, [] as RealtorLeadRow[]]),
  ) as Record<RealtorLeadStatus, RealtorLeadRow[]>;
  for (const lead of leads) {
    grouped[lead.status]?.push(lead);
  }
  return grouped;
}

export default async function RealtorLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const { view } = await searchParams;
  const leads = await loadRealtorLeads(workspaceId);
  const isPipeline = view === "pipeline";
  const grouped = groupByStatus(leads);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={isPipeline ? "Lead Pipeline" : "Leads"}
        description="Every conversation flows back to a lead record."
      />
      <div className="flex flex-wrap gap-2">
        <Link
          href="/realtor/leads"
          className={cn(
            "inline-flex h-8 items-center rounded-md border px-3 text-xs",
            !isPipeline && "border-primary bg-primary/5 font-medium text-primary",
          )}
        >
          All Leads
        </Link>
        <Link
          href="/realtor/leads?view=pipeline"
          className={cn(
            "inline-flex h-8 items-center rounded-md border px-3 text-xs",
            isPipeline && "border-primary bg-primary/5 font-medium text-primary",
          )}
        >
          Pipeline
        </Link>
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

      {isPipeline ? (
        <div className="grid gap-4 lg:grid-cols-4 xl:grid-cols-7">
          {REALTOR_PIPELINE_COLUMNS.map((column) => (
            <Card key={column.status} className="flex min-h-[280px] flex-col">
              <div className="border-b px-3 py-2">
                <CardTitle className="text-sm">
                  {column.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({grouped[column.status]?.length || 0})
                  </span>
                </CardTitle>
              </div>
              <ul className="flex-1 space-y-2 p-2">
                {(grouped[column.status] || []).slice(0, 12).map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/realtor/leads/${lead.id}`}
                      className="block rounded-lg border bg-background p-2 text-sm hover:border-primary/40"
                    >
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{formatPhone(lead.phone)}</p>
                      {lead.intent ? (
                        <p className="mt-1 text-xs capitalize text-muted-foreground">{lead.intent}</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
}
