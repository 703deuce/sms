import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
} from "@/components/ui/metric";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contactTabs } from "@/lib/contact-tabs";
import { tags } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import {
  Layers,
  MoreHorizontal,
  Star,
  Tag,
  TagIcon,
} from "lucide-react";

const tagDots = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-rose-500",
];

export default function ContactTagsPage() {
  const totalTagged = tags.reduce((sum, tag) => sum + tag.count, 0);
  const mostUsed = [...tags].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Tags"
        description="Label contacts for filtering, automations, and inbox organization."
        actions={
          <Button className="rounded-[10px]">
            <Tag className="h-4 w-4" />
            Create tag
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Tags"
          value={formatNumber(tags.length)}
          hint="Total tags created"
          icon={Tag}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Tagged Instances"
          value={formatNumber(totalTagged)}
          hint="Contacts can have multiple tags"
          icon={Layers}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Most Used"
          value={mostUsed?.name ?? "—"}
          hint={`${formatNumber(mostUsed?.count ?? 0)} contacts`}
          icon={Star}
          tone="bg-emerald-50 text-emerald-600"
        />
      </div>

      <Card className="mb-5 rounded-[12px] p-4">
        <h2 className="text-[14px] font-bold text-foreground">Create a new tag</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="new-tag" className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
              Tag name
            </label>
            <Input id="new-tag" placeholder="e.g. vip-customer" className="h-10 rounded-[10px]" />
          </div>
          <Button className="rounded-[10px]">Add tag</Button>
        </div>
      </Card>

      <div className="mb-5 flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px]"
          >
            <TagIcon className="h-3.5 w-3.5 text-primary" />
            <span className={`h-2 w-2 rounded-full ${tagDots[index % tagDots.length]}`} />
            <span className="font-medium">{tag.name}</span>
            <span className="tabular-nums text-muted-foreground">{formatNumber(tag.count)}</span>
          </span>
        ))}
      </div>

      <Card className="rounded-[12px] p-4">
        <h2 className="mb-4 text-[14px] font-bold text-foreground">Tag management</h2>
        <Table className="text-[13px]">
          <THead>
            <TR>
              <TH>Tag</TH>
              <TH>Contacts</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {tags.map((tag, index) => (
              <TR key={tag.id}>
                <TD>
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <span className={`h-2.5 w-2.5 rounded-full ${tagDots[index % tagDots.length]}`} />
                    {tag.name}
                  </span>
                </TD>
                <TD className="tabular-nums">{formatNumber(tag.count)}</TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="text-[12px]">
                      View contacts
                    </Button>
                    <Button variant="ghost" size="sm" className="text-[12px]">
                      Rename
                    </Button>
                    <Button variant="ghost" size="sm" className="text-[12px] text-danger">
                      Delete
                    </Button>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      aria-label={`More actions for ${tag.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <PaginationBar rangeLabel={`Showing ${tags.length} of ${tags.length} tags`} />
      </Card>
    </div>
  );
}
