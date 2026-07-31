import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadSegments } from "@/lib/workspace-data";

type SegmentRow = Awaited<ReturnType<typeof loadSegments>>[number];
import { formatNumber } from "@/lib/utils";
import { Filter, Plus } from "lucide-react";
import Link from "next/link";

const contactTabs = [
  { label: "All Contacts", href: "/contacts" },
  { label: "Lists", href: "/contacts/lists" },
  { label: "Segments", href: "/contacts/segments" },
  { label: "Tags", href: "/contacts/tags" },
  { label: "Imports", href: "/contacts/imports" },
  { label: "Custom Fields", href: "/contacts/fields" },
];

function formatConditions(conditions: unknown): string {
  if (!conditions) return "—";
  if (typeof conditions === "string") return conditions;
  if (typeof conditions === "object") {
    const obj = conditions as Record<string, unknown>;
    if (Object.keys(obj).length === 0) return "No conditions defined";
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" · ");
  }
  return String(conditions);
}

export default async function ContactSegmentsPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Segments" description="Dynamic audiences based on behavior, engagement, and contact properties." />
        <EmptyState
          title="No workspace selected"
          description="Select or create a workspace to manage segments."
        />
      </div>
    );
  }

  const segments: SegmentRow[] = await loadSegments(workspaceId);

  return (
    <div>
      <PageHeader
        title="Segments"
        description="Dynamic audiences based on behavior, engagement, and contact properties."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Create segment
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active segments" value={formatNumber(segments.length)} />
        <StatCard label="Combined reach" value="—" hint="Contact counts computed at send time" />
        <StatCard label="Most engaged" value={segments[0]?.name ?? "—"} hint="Based on segment order" />
      </div>

      {segments.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-10 w-10" />}
          title="No segments yet"
          description="Create dynamic segments to target contacts based on rules and behavior."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {segments.map((segment) => (
              <Card key={segment.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Filter className="h-5 w-5" />
                  </div>
                  <Button variant="ghost" size="sm">
                    Edit rules
                  </Button>
                </div>
                <CardTitle className="mt-4">{segment.name}</CardTitle>
                <p className="mt-2 font-display text-2xl font-semibold">—</p>
                <p className="text-xs text-muted-foreground">matching contacts</p>
                <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conditions</p>
                  <p className="mt-1 text-sm">{formatConditions(segment.conditions)}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm">
                    Preview contacts
                  </Button>
                  <Link href="/send">
                    <Button size="sm">Use in campaign</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <CardTitle>Segment rules</CardTitle>
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Segment</TH>
                  <TH>Count</TH>
                  <TH>Conditions</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {segments.map((segment) => (
                  <TR key={segment.id}>
                    <TD className="font-medium">{segment.name}</TD>
                    <TD>—</TD>
                    <TD className="max-w-md text-muted-foreground">
                      {formatConditions(segment.conditions)}
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Link href="/send">
                          <Button variant="ghost" size="sm">
                            Campaign
                          </Button>
                        </Link>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
