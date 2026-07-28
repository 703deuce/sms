import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
} from "@/components/ui/metric";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { contacts } from "@/lib/mock/data";
import { formatNumber, formatPhone } from "@/lib/utils";
import { Download, Users, UserMinus } from "lucide-react";
import Link from "next/link";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UnsubscribedContactsPage() {
  const filtered = contacts.filter((c) => c.status === "Unsubscribed");

  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Unsubscribed"
        description="Contacts who opted out via STOP or manual unsubscribe. They cannot receive campaigns."
        actions={
          <>
            <Link href="/contacts">
              <Button variant="outline" className="rounded-[10px]">
                <Users className="h-4 w-4" />
                All contacts
              </Button>
            </Link>
            <Button variant="outline" className="rounded-[10px]">
              <Download className="h-4 w-4" />
              Export list
            </Button>
          </>
        }
      />

      <div className="mb-5 max-w-sm">
        <MetricCard
          label="Unsubscribed contacts"
          value={formatNumber(filtered.length)}
          hint="Total opted-out contacts"
          icon={UserMinus}
          tone="bg-violet-50 text-violet-600"
        />
      </div>

      {filtered.length > 0 ? (
        <Card className="rounded-[12px] p-4">
          <Table className="text-[13px]">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Phone</TH>
                <TH>Email</TH>
                <TH>Status</TH>
                <TH>Consent source</TH>
                <TH>Consent date</TH>
                <TH>Last messaged</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((contact) => (
                <TR key={contact.id}>
                  <TD>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {contact.firstName} {contact.lastName}
                    </Link>
                  </TD>
                  <TD>{formatPhone(contact.phone)}</TD>
                  <TD className="text-muted-foreground">{contact.email || "—"}</TD>
                  <TD>
                    <StatusChip status={contact.status} />
                  </TD>
                  <TD className="text-muted-foreground">{contact.consentSource}</TD>
                  <TD className="text-muted-foreground">{formatDate(contact.consentDate)}</TD>
                  <TD className="text-muted-foreground">{formatDate(contact.lastMessaged)}</TD>
                  <TD>
                    <Link href={`/contacts/${contact.id}`}>
                      <Button variant="ghost" size="sm" className="text-[12px] text-primary">
                        View
                      </Button>
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <PaginationBar
            rangeLabel={`Showing ${filtered.length} of ${filtered.length} contact${filtered.length === 1 ? "" : "s"}`}
          />
        </Card>
      ) : (
        <EmptyState
          icon={<UserMinus className="h-10 w-10" />}
          title="No unsubscribed contacts"
          description="When contacts reply STOP or are manually unsubscribed, they'll appear here."
          actionLabel="View all contacts"
          actionHref="/contacts"
        />
      )}
    </div>
  );
}
