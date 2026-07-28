import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contacts } from "@/lib/mock/data";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";

const complianceTabs = [
  { label: "Overview", href: "/compliance" },
  { label: "Business", href: "/compliance/business" },
  { label: "Brand", href: "/compliance/brand" },
  { label: "Campaign", href: "/compliance/campaign" },
  { label: "Readiness", href: "/compliance/check" },
  { label: "Consent", href: "/compliance/consent" },
  { label: "Suppression", href: "/compliance/suppression" },
  { label: "Events", href: "/compliance/events" },
];

export default function ComplianceConsentPage() {
  const consented = contacts.filter((c) => c.status === "Subscribed");

  return (
    <div>
      <PageHeader
        title="Consent records"
        description="Proof of opt-in per contact — source, date, and current subscription status."
        actions={
          <Link href="/contacts/imports">
            <Button variant="outline">Import with consent</Button>
          </Link>
        }
      />

      <Tabs items={complianceTabs} />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Consent log</CardTitle>
          <span className="text-xs text-muted-foreground">{consented.length} subscribed contacts</span>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Contact</TH>
              <TH>Phone</TH>
              <TH>Consent source</TH>
              <TH>Consent date</TH>
              <TH>Status</TH>
              <TH>Lists</TH>
            </TR>
          </THead>
          <TBody>
            {contacts.map((contact) => (
              <TR key={contact.id}>
                <TD className="font-medium">
                  {contact.firstName} {contact.lastName}
                </TD>
                <TD>{formatPhone(contact.phone)}</TD>
                <TD className="text-muted-foreground">{contact.consentSource}</TD>
                <TD className="text-muted-foreground">{contact.consentDate}</TD>
                <TD>
                  <StatusChip status={contact.status} />
                </TD>
                <TD className="text-muted-foreground">
                  {contact.lists.length > 0 ? contact.lists.join(", ") : "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="mt-4 text-xs text-muted-foreground">
          Consent records are retained for audit purposes. Import contacts only with documented opt-in permission.
        </p>
      </Card>
    </div>
  );
}
