import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PaginationBar,
  SectionHeader,
} from "@/components/ui/metric";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contactTabs } from "@/lib/contact-tabs";
import { contacts } from "@/lib/mock/data";
import { formatPhone } from "@/lib/utils";
import {
  MoreHorizontal,
  PhoneOff,
  RefreshCw,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InvalidContactsPage() {
  const filtered = contacts.filter((c) => c.status === "Invalid");

  return (
    <div className="text-[13px]">
      <SectionHeader
        icon={PhoneOff}
        iconTone="bg-violet-50 text-violet-600"
        title="Invalid numbers"
        description="Landlines, malformed numbers, or unreachable devices detected during validation or delivery."
        actions={
          <>
            <Link href="/contacts">
              <Button variant="outline" className="rounded-[10px]">
                <Users className="h-4 w-4" />
                All contacts
              </Button>
            </Link>
            <Link href="/contacts/imports">
              <Button className="rounded-[10px]">
                <Upload className="h-4 w-4" />
                Re-import corrected
              </Button>
            </Link>
          </>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-5 flex flex-col gap-3 rounded-[12px] border border-violet-200/80 bg-violet-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14px] font-bold text-violet-950">Keep your lists healthy</p>
          <p className="mt-1 text-[12px] text-violet-900/80">
            Review invalid numbers regularly so campaigns stay deliverable and credits aren’t wasted.
          </p>
        </div>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-violet-100 text-violet-600">
          <PhoneOff className="h-7 w-7" />
        </span>
      </div>

      {filtered.length > 0 ? (
        <Card className="rounded-[12px] p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-foreground">
                {filtered.length} invalid number{filtered.length === 1 ? "" : "s"}
              </h2>
              <p className="text-[12px] text-muted-foreground">
                Numbers that couldn’t be delivered to.
              </p>
            </div>
            <p className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              Last updated: Jul 1, 2026 at 10:24 AM
            </p>
          </div>

          <Table className="text-[13px]">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Phone</TH>
                <TH>Status</TH>
                <TH>Lists</TH>
                <TH>Consent source</TH>
                <TH>Date added</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((contact) => (
                <TR key={contact.id}>
                  <TD>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="inline-flex items-center gap-2 font-semibold text-foreground hover:text-primary"
                    >
                      <PhoneOff className="h-4 w-4 text-violet-500" />
                      {contact.firstName} {contact.lastName}
                    </Link>
                  </TD>
                  <TD>{formatPhone(contact.phone)}</TD>
                  <TD>
                    <StatusChip status={contact.status} />
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {contact.lists.length > 0 ? (
                        contact.lists.map((list) => (
                          <span
                            key={list}
                            className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
                          >
                            {list}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TD>
                  <TD className="text-muted-foreground">{contact.consentSource}</TD>
                  <TD className="text-muted-foreground">{formatDate(contact.dateAdded)}</TD>
                  <TD>
                    <div className="flex items-center gap-1">
                      <Link href={`/contacts/${contact.id}`}>
                        <Button variant="ghost" size="sm" className="text-[12px] text-primary">
                          View
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="text-[12px] text-danger">
                        Remove
                      </Button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                        aria-label={`More actions for ${contact.firstName}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <PaginationBar
            rangeLabel={`Showing ${filtered.length} of ${filtered.length}`}
          />
        </Card>
      ) : (
        <EmptyState
          icon={<PhoneOff className="h-10 w-10" />}
          title="No invalid numbers"
          description="Invalid numbers are flagged automatically and excluded from sends to protect deliverability."
          actionLabel="View all contacts"
          actionHref="/contacts"
        />
      )}
    </div>
  );
}
