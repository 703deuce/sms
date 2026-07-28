import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
} from "@/components/ui/metric";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contactTabs } from "@/lib/contact-tabs";
import { lists } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import {
  ListPlus,
  MoreHorizontal,
  Send,
  Settings2,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";

export default function ContactListsPage() {
  const totalMembers = lists.reduce((sum, list) => sum + list.count, 0);
  const largest = [...lists].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Lists"
        description="Static groups for campaigns, automations, and audience targeting."
        actions={
          <>
            <Button variant="outline" className="rounded-[10px]">
              <ListPlus className="h-4 w-4" />
              Create list
            </Button>
            <Link href="/contacts/imports">
              <Button className="rounded-[10px]">
                <Upload className="h-4 w-4" />
                Import to list
              </Button>
            </Link>
          </>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Lists"
          value={formatNumber(lists.length)}
          icon={Users}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Total Memberships"
          value={formatNumber(totalMembers)}
          hint="Contacts may belong to multiple lists"
          icon={Users}
          tone="bg-sky-50 text-sky-600"
        />
        <MetricCard
          label="Largest List"
          value={largest?.name ?? "—"}
          hint={`${formatNumber(largest?.count ?? 0)} contacts`}
          icon={Users}
          tone="bg-violet-50 text-violet-600"
        />
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lists.map((list) => (
          <Card key={list.id} className="flex flex-col rounded-[12px] p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600">
                <Users className="h-5 w-5" />
              </span>
              <button
                type="button"
                className="text-[12px] font-semibold text-primary hover:underline"
              >
                Edit
              </button>
            </div>
            <h3 className="mt-4 text-[15px] font-bold text-foreground">{list.name}</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">{list.description}</p>
            <p className="mt-4 text-[22px] font-bold tabular-nums text-primary">
              {formatNumber(list.count)}
            </p>
            <p className="text-[11px] text-muted-foreground">contacts</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 rounded-[10px]">
                View contacts
              </Button>
              <Link href="/send" className="flex-1">
                <Button size="sm" className="w-full rounded-[10px]">
                  <Send className="h-3.5 w-3.5" />
                  Send campaign
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Card className="rounded-[12px] p-4">
        <h2 className="mb-4 text-[14px] font-bold text-foreground">All lists</h2>
        <Table className="text-[13px]">
          <THead>
            <TR>
              <TH>List name</TH>
              <TH>Contacts</TH>
              <TH>Description</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {lists.map((list) => (
              <TR key={list.id}>
                <TD>
                  <span className="inline-flex items-center gap-2.5 font-semibold">
                    <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-emerald-50 text-emerald-600">
                      <Users className="h-4 w-4" />
                    </span>
                    {list.name}
                  </span>
                </TD>
                <TD className="tabular-nums font-medium">{formatNumber(list.count)}</TD>
                <TD className="text-muted-foreground">{list.description}</TD>
                <TD>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="text-[12px]">
                      <Settings2 className="h-3.5 w-3.5" />
                      Manage
                    </Button>
                    <Link href="/send">
                      <Button variant="ghost" size="sm" className="text-[12px]">
                        <Send className="h-3.5 w-3.5" />
                        Campaign
                      </Button>
                    </Link>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      aria-label={`More actions for ${list.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <PaginationBar rangeLabel={`Showing ${lists.length} of ${lists.length} lists`} />
      </Card>
    </div>
  );
}
