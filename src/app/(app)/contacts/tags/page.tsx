import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { tags } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import { Tag, TagIcon } from "lucide-react";

const contactTabs = [
  { label: "All Contacts", href: "/contacts" },
  { label: "Lists", href: "/contacts/lists" },
  { label: "Segments", href: "/contacts/segments" },
  { label: "Tags", href: "/contacts/tags" },
  { label: "Imports", href: "/contacts/imports" },
  { label: "Custom Fields", href: "/contacts/fields" },
];

export default function ContactTagsPage() {
  const totalTagged = tags.reduce((sum, tag) => sum + tag.count, 0);

  return (
    <div>
      <PageHeader
        title="Tags"
        description="Label contacts for filtering, automations, and inbox organization."
        actions={
          <Button>
            <Tag className="h-4 w-4" />
            Create tag
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Tags" value={formatNumber(tags.length)} />
        <StatCard label="Tagged instances" value={formatNumber(totalTagged)} hint="Contacts can have multiple tags" />
        <StatCard label="Most used" value={tags[1]?.name ?? "—"} hint={`${formatNumber(tags[1]?.count ?? 0)} contacts`} />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="new-tag" className="mb-1.5 block text-sm font-medium">
              New tag name
            </label>
            <Input id="new-tag" placeholder="e.g. vip-customer" />
          </div>
          <Button>Add tag</Button>
        </div>
      </Card>

      <div className="mb-6 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
          >
            <TagIcon className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{tag.name}</span>
            <span className="text-muted-foreground">{formatNumber(tag.count)}</span>
          </span>
        ))}
      </div>

      <Card>
        <CardTitle>Tag management</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Tag</TH>
              <TH>Contacts</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {tags.map((tag) => (
              <TR key={tag.id}>
                <TD>
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {tag.name}
                  </span>
                </TD>
                <TD>{formatNumber(tag.count)}</TD>
                <TD>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      View contacts
                    </Button>
                    <Button variant="ghost" size="sm">
                      Rename
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger">
                      Delete
                    </Button>
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
