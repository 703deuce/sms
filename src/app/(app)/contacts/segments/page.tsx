import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { segments } from "@/lib/mock/data";
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

export default function ContactSegmentsPage() {
  const totalReach = segments.reduce((sum, seg) => sum + seg.count, 0);

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
        <StatCard label="Combined reach" value={formatNumber(totalReach)} hint="Unique contacts may overlap" />
        <StatCard label="Most engaged" value={segments[0]?.name ?? "—"} hint={`${formatNumber(segments[0]?.count ?? 0)} contacts`} />
      </div>

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
            <p className="mt-2 font-display text-2xl font-semibold">{formatNumber(segment.count)}</p>
            <p className="text-xs text-muted-foreground">matching contacts</p>
            <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conditions</p>
              <p className="mt-1 text-sm">{segment.conditions}</p>
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
                <TD>{formatNumber(segment.count)}</TD>
                <TD className="max-w-md text-muted-foreground">{segment.conditions}</TD>
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
    </div>
  );
}
