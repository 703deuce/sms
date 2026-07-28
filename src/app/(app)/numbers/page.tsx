import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { phoneNumbers } from "@/lib/mock/data";
import { formatCurrency, formatPhone } from "@/lib/utils";
import Link from "next/link";

const numberTabs = [
  { label: "My Numbers", href: "/numbers" },
  { label: "Buy", href: "/numbers/buy" },
  { label: "Port", href: "/numbers/port" },
  { label: "Sender Pools", href: "/numbers/pools" },
];

export default function NumbersPage() {
  return (
    <div>
      <PageHeader
        title="Phone numbers"
        description="Manage sending numbers, A2P registration status, and monthly costs."
        actions={
          <>
            <Link href="/numbers/port">
              <Button variant="outline">Port a number</Button>
            </Link>
            <Link href="/numbers/buy">
              <Button>Buy number</Button>
            </Link>
          </>
        }
      />

      <Tabs items={numberTabs} />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>My numbers</CardTitle>
          <span className="text-xs text-muted-foreground">{phoneNumbers.length} active</span>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Number</TH>
              <TH>Friendly name</TH>
              <TH>Type</TH>
              <TH>A2P status</TH>
              <TH>Messaging service</TH>
              <TH>Assigned</TH>
              <TH>Monthly</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {phoneNumbers.map((pn) => (
              <TR key={pn.id}>
                <TD>
                  <Link
                    href={`/numbers/${pn.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {formatPhone(pn.number)}
                  </Link>
                </TD>
                <TD>{pn.friendlyName}</TD>
                <TD>{pn.type}</TD>
                <TD>
                  <StatusChip status={pn.a2pStatus} />
                </TD>
                <TD className="text-muted-foreground">{pn.messagingService}</TD>
                <TD className="text-muted-foreground">
                  {pn.assignedUsers.length > 0 ? pn.assignedUsers.join(", ") : "—"}
                </TD>
                <TD>{formatCurrency(pn.monthlyCost)}</TD>
                <TD>
                  <StatusChip status={pn.status} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
