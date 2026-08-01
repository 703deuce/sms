import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { CreateListButton } from "@/components/contacts/create-list-button";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadLists } from "@/lib/workspace-data";

type ContactListRow = Awaited<ReturnType<typeof loadLists>>[number];
import { formatNumber } from "@/lib/utils";
import { Users } from "lucide-react";
import Link from "next/link";
import { contactTabs } from "@/lib/contact-tabs";

export default async function ContactListsPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Lists" description="Static groups for campaigns, automations, and audience targeting." />
        <EmptyState
          title="No workspace selected"
          description="Select or create a workspace to manage lists."
        />
      </div>
    );
  }

  const lists: ContactListRow[] = await loadLists(workspaceId);
  const sortedLists = [...lists].sort((a, b) => b.contactCount - a.contactCount);
  const totalMembers = lists.reduce((sum, list) => sum + list.contactCount, 0);

  return (
    <div>
      <PageHeader
        title="Lists"
        description="Static groups for campaigns, automations, and audience targeting."
        actions={
          <>
            <CreateListButton />
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
        <StatCard label="Largest list" value={sortedLists[0]?.name ?? "—"} hint={`${formatNumber(sortedLists[0]?.contactCount ?? 0)} contacts`} />
      </div>

      {lists.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No lists yet"
          description="Create a list to organize contacts for campaigns and automations."
        />
      ) : (
        <>
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
                <p className="mt-4 font-display text-2xl font-semibold">{formatNumber(list.contactCount)}</p>
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
                    <TD>{formatNumber(list.contactCount)}</TD>
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
        </>
      )}
    </div>
  );
}
