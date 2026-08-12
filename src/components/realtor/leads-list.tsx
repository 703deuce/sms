import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { RealtorLeadRow } from "@/lib/realtor/types";
import { cn, formatPhone } from "@/lib/utils";
import Link from "next/link";

const FAST_VIEWS: Array<{ id: string; label: string; href: string }> = [
  { id: "all", label: "All", href: "/realtor/leads" },
  { id: "new", label: "New", href: "/realtor/leads?view=new" },
  { id: "hot", label: "Hot", href: "/realtor/leads?view=hot" },
  { id: "needs_attention", label: "Needs Attention", href: "/realtor/leads?view=needs_attention" },
  { id: "qualified", label: "Qualified", href: "/realtor/leads?view=qualified" },
  { id: "appointments", label: "Appointments", href: "/realtor/leads?view=appointments" },
  { id: "nurture", label: "Nurture", href: "/realtor/leads?view=nurture" },
];

function nextActionLabel(lead: RealtorLeadRow): string {
  if (lead.needsAttention) return "Follow up";
  if (lead.status === "appointment") return "Appointment";
  if (lead.status === "qualified") return "Schedule or call";
  if (lead.status === "new") return "Amy working";
  return "—";
}

export function RealtorLeadsListView({
  leads,
  activeView,
  searchQuery,
}: {
  leads: RealtorLeadRow[];
  activeView: string;
  searchQuery?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every conversation flows back to a lead record.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" action="/realtor/leads" method="get">
        {activeView !== "all" ? (
          <input type="hidden" name="view" value={activeView} />
        ) : null}
        <input
          name="q"
          value={searchQuery || ""}
          placeholder="Search leads…"
          className="h-9 min-w-[220px] rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit" size="sm" variant="outline">Search</Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {FAST_VIEWS.map((view) => (
          <Link
            key={view.id}
            href={view.href}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
              activeView === view.id && "border-primary bg-primary/5 text-primary",
            )}
          >
            {view.label}
          </Link>
        ))}
        <Link
          href="/realtor/test"
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
        >
          Add Test Lead
        </Link>
      </div>

      {leads.length ? (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Lead</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                <TH>Source</TH>
                <TH>Last Contact</TH>
                <TH>Next Action</TH>
                <TH>Assigned</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {leads.map((lead) => (
                <TR key={lead.id}>
                  <TD>
                    <Link
                      href={`/realtor/leads/${lead.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {lead.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatPhone(lead.phone)}</p>
                  </TD>
                  <TD className="capitalize">{lead.intent || "—"}</TD>
                  <TD>
                    <StatusChip status={lead.status} />
                  </TD>
                  <TD>{lead.source || "—"}</TD>
                  <TD className="text-muted-foreground">
                    {lead.lastActivityAt
                      ? new Date(lead.lastActivityAt).toLocaleString()
                      : "—"}
                  </TD>
                  <TD>{nextActionLabel(lead)}</TD>
                  <TD>{lead.assignedTo || "Amy"}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link href={`/phone?contact=${lead.id}`} className="text-primary">Call</Link>
                      <Link href={`/inbox?contact=${lead.id}`} className="text-primary">Text</Link>
                      <Link href="/realtor/test" className="text-primary">Have Amy Call</Link>
                      <Link href={`/realtor/leads/${lead.id}`} className="text-muted-foreground">
                        More
                      </Link>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          title="No leads in this view"
          description="Try another filter or add a test lead to see the CRM flow."
          actionLabel="Add test lead"
          actionHref="/realtor/test"
        />
      )}
    </div>
  );
}
