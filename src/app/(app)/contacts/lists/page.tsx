import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { lists } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import { ListPlus, Users } from "lucide-react";
import Link from "next/link";

const contactTabs = [
  { label: "All Contacts", href: "/contacts" },
  { label: "Lists", href: "/contacts/lists" },
  { label: "Segments", href: "/contacts/segments" },
  { label: "Tags", href: "/contacts/tags" },
  { label: "Imports", href: "/contacts/imports" },
  { label: "Custom Fields", href: "/contacts/fields" },
];

export default function ContactListsPage() {
  const totalMembers = lists.reduce((sum, list) => sum + list.count, 0);

  return (
    <div>
      <PageHeader
        title="Lists"
        description="Static groups for campaigns, automations, and audience targeting."
        actions={
          <>
            <Button variant="outline">
              <ListPlus className="h-4 w-4" />
              Create list
            </Button>
            <Link href="/contacts/imports">
              <Button>Import to list</Button>
            </Link>
          </>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Lists" value={formatNumber(lists.length)} />
        <StatCard label="Total memberships" value={formatNumber(totalMembers)} hint="Contacts may belong to multiple lists" />
        <StatCard label="Largest list" value={lists[0]?.name ?? "—"} hint={`${formatNumber(lists[0]?.count ?? 0)} contacts`} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lists.map((list) => (
          <Card key={list.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            </div>
            <CardTitle className="mt-4">{list.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>
            <p className="mt-4 font-display text-2xl font-semibold">{formatNumber(list.count)}</p>
            <p className="text-xs text-muted-foreground">contacts</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                View contacts
              </Button>
              <Link href="/send" className="flex-1">
                <Button size="sm" className="w-full">
                  Send campaign
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>All lists</CardTitle>
        <Table className="mt-4">
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
                <TD className="font-medium">{list.name}</TD>
                <TD>{formatNumber(list.count)}</TD>
                <TD className="text-muted-foreground">{list.description}</TD>
                <TD>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      Manage
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
