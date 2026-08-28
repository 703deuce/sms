import { CreateListButton } from "@/components/contacts/create-list-button";
import {
  SlickAudienceHeader,
  SlickTableToolbar,
  formatSlickDateTime,
} from "@/components/audience/slick-audience-ui";
import { RowActionsMenu } from "@/components/audience/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PaginationBar } from "@/components/ui/metric";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import { contactTabs } from "@/lib/contact-tabs";
import { loadLists } from "@/lib/workspace-data";
import { formatNumber } from "@/lib/utils";
import { Filter, List, Pencil, Users } from "lucide-react";
import Link from "next/link";

export default async function ContactListsPage() {
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

  const lists = await loadLists(workspaceId);

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

        {lists.length === 0 ? (
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
                          { label: "Edit", icon: Pencil, href: "#" },
                          { label: "View contacts", icon: Users, href: `/contacts?list=${list.id}` },
                        ]}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <select className="rounded border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-500">
                <option>25 Per Page</option>
              </select>
              <PaginationBar rangeLabel={`1–${lists.length} of ${lists.length}`} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
