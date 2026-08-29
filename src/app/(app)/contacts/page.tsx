import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
import {
  formatSlickDateTime,
  SlickAudienceHeader,
  SlickOptInBadge,
  SlickStatCard,
  SlickTableToolbar,
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
import type { Contact } from "@/lib/types";
import { loadContacts } from "@/lib/workspace-data";
import { formatPhone } from "@/lib/utils";
import { Filter, UserCheck, UserMinus, Users } from "lucide-react";
import Link from "next/link";

export default async function ContactsPage() {
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return (
      <div>
        <SlickAudienceHeader
          title="Contacts"
          description="View and manage all of your contacts."
          icon={Users}
        />
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No workspace selected"
          description="Select or create a workspace to view contacts."
        />
      </div>
    );
  }

  const contacts: Contact[] = await loadContacts(workspaceId);
  const total = contacts.length;
  const subscribed = contacts.filter((c) => c.status === "Subscribed").length;
  const unsubscribed = contacts.filter((c) => c.status === "Unsubscribed").length;
  const shown = contacts.length;

  return (
    <div className="text-[13px]">
      <SlickAudienceHeader
        title="Contacts"
        description="View and manage all of your contacts."
        icon={Users}
      />

      <Tabs items={contactTabs} />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <SlickStatCard label="Contacts" value={total} icon={Users} tone="violet" />
        <SlickStatCard
          label="Subscribed Contacts"
          value={subscribed}
          icon={UserCheck}
          tone="green"
          showInfo
        />
        <SlickStatCard
          label="Unsubscribed Contacts"
          value={unsubscribed}
          icon={UserMinus}
          tone="rose"
          showInfo
          href="/contacts/unsubscribed"
        />
      </div>

      <Card className="rounded-xl border-slate-200 p-4 shadow-sm">
        <SlickTableToolbar
          createSlot={<AddContactDialog triggerLabel="Create Contact" />}
          filterSlot={
            <Button variant="outline" size="sm" className="h-10 gap-2 border-slate-200">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          }
        />

        {contacts.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No contacts yet"
            description="Import contacts or add them manually to start building your audience."
            actionLabel="Create contact"
            actionHref="/contacts"
          />
        ) : (
          <>
            <Table className="text-[13px]">
              <THead>
                <TR className="border-slate-200">
                  <TH className="w-10">
                    <input type="checkbox" aria-label="Select all contacts" className="rounded" />
                  </TH>
                  <TH>First Name</TH>
                  <TH>Last Name</TH>
                  <TH>Mobile Number</TH>
                  <TH>Email</TH>
                  <TH>Opt-in Status</TH>
                  <TH>Created</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <TBody>
                {contacts.map((contact) => (
                  <TR key={contact.id} className="border-slate-100">
                    <TD>
                      <input
                        type="checkbox"
                        aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                        className="rounded"
                      />
                    </TD>
                    <TD>
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {contact.firstName}
                      </Link>
                    </TD>
                    <TD>
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-medium text-slate-800 hover:text-primary"
                      >
                        {contact.lastName}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap text-primary">{formatPhone(contact.phone)}</TD>
                    <TD className="text-slate-500">{contact.email || "—"}</TD>
                    <TD>
                      <SlickOptInBadge status={contact.status} />
                    </TD>
                    <TD className="whitespace-nowrap text-slate-500">
                      {formatSlickDateTime(contact.consentDate || contact.lastMessaged)}
                    </TD>
                    <TD>
                      <RowActionsMenu
                        actions={[
                          {
                            label: "View",
                            icon: "users",
                            href: `/contacts/${contact.id}`,
                          },
                        ]}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <label className="inline-flex items-center gap-2 text-[12px] text-slate-500">
                <select className="rounded border border-slate-200 bg-white px-2 py-1 text-[12px]">
                  <option>25 Per Page</option>
                  <option>50 Per Page</option>
                  <option>100 Per Page</option>
                </select>
              </label>
              <PaginationBar rangeLabel={`1–${shown} of ${total}`} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
