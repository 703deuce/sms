import { CreateListButton } from "@/components/contacts/create-list-button";
import { AudienceTablePagination } from "@/components/audience/audience-table-pagination";
import {
  SlickAudienceHeader,
  SlickTableToolbar,
  formatSlickDateTime,
} from "@/components/audience/slick-audience-ui";
import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import { parseAudiencePagination } from "@/lib/contacts/audience-pagination";
import { contactTabs } from "@/lib/contact-tabs";
import { loadListsPage } from "@/lib/workspace-data";
import { formatNumber } from "@/lib/utils";
import { Filter, List, Users } from "lucide-react";
import { Suspense } from "react";

type SearchParams = Promise<{ page?: string; perPage?: string }>;

export default async function ContactListsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <SlickAudienceHeader
          title="Lists"
          description="View and manage all of your contact lists."
          icon={List}
        />
        <EmptyState title="No workspace selected" description="Select a workspace to manage lists." />
      </div>
    );
  }

  const params = await searchParams;
  const { page, perPage } = parseAudiencePagination(params);
  const { lists, total } = await loadListsPage(workspaceId, { page, perPage });

  return (
    <div className="text-[13px]">
      <SlickAudienceHeader
        title="Lists"
        description="View and manage all of your contact lists."
        icon={List}
      />

      <Tabs items={contactTabs} />

      <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
        <SlickTableToolbar
          createSlot={<CreateListButton label="Create List" />}
          filterSlot={
            <Button variant="outline" size="sm" className="h-10 gap-2 border-slate-200">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          }
        />

        {total === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No lists yet"
            description="Create a list to organize contacts for campaigns and automations."
          />
        ) : (
          <>
            <Table className="text-[13px]">
              <THead>
                <TR className="border-slate-200">
                  <TH>List Name</TH>
                  <TH>Contacts</TH>
                  <TH>Description</TH>
                  <TH>Last Updated</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <TBody>
                {lists.map((list) => (
                  <TR key={list.id} className="border-slate-100">
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <List className="h-4 w-4" />
                        </span>
                        <span className="font-semibold text-slate-900">{list.name}</span>
                      </div>
                      <p className="mt-1 text-[12px] text-slate-400">
                        Last saved on {formatSlickDateTime(new Date().toISOString())}
                      </p>
                    </TD>
                    <TD className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <List className="h-4 w-4" />
                        {formatNumber(list.contactCount)} Connected Contacts
                      </span>
                    </TD>
                    <TD className="max-w-md text-slate-600">{list.description || "—"}</TD>
                    <TD className="whitespace-nowrap text-slate-500">
                      {formatSlickDateTime(new Date().toISOString())}
                    </TD>
                    <TD>
                      <RowActionsMenu
                        actions={[
                          { label: "Edit", icon: "pencil", href: "#" },
                          { label: "View contacts", icon: "users", href: `/contacts?list=${list.id}` },
                        ]}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            <Suspense fallback={null}>
              <AudienceTablePagination page={page} perPage={perPage} total={total} />
            </Suspense>
          </>
        )}
      </Card>
    </div>
  );
}
