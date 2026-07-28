import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contacts } from "@/lib/mock/data";
import { formatNumber, formatPhone } from "@/lib/utils";

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

type SuppressionEntry = {
  id: string;
  name: string;
  phone: string;
  reason: "STOP" | "Manual" | "Blocked" | "Invalid";
  date: string;
  source: string;
};

const suppressionList: SuppressionEntry[] = [
  ...contacts
    .filter((c) => c.status === "Unsubscribed")
    .map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      phone: c.phone,
      reason: "STOP" as const,
      date: c.lastReply ?? c.consentDate,
      source: "Inbound keyword",
    })),
  ...contacts
    .filter((c) => c.status === "Blocked")
    .map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      phone: c.phone,
      reason: "Blocked" as const,
      date: c.consentDate,
      source: "Manual block",
    })),
  ...contacts
    .filter((c) => c.status === "Invalid")
    .map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      phone: c.phone,
      reason: "Invalid" as const,
      date: c.dateAdded,
      source: "Carrier lookup",
    })),
];

const reasonToStatus = {
  STOP: "Unsubscribed",
  Manual: "Blocked",
  Blocked: "Blocked",
  Invalid: "Invalid",
} as const;

export default function ComplianceSuppressionPage() {
  const stopCount = suppressionList.filter((e) => e.reason === "STOP").length;
  const blockedCount = suppressionList.filter((e) => e.reason === "Blocked").length;
  const invalidCount = suppressionList.filter((e) => e.reason === "Invalid").length;

  return (
    <div>
      <PageHeader
        title="Suppression list"
        description="Combined STOP opt-outs, manual blocks, and invalid numbers — excluded from all sends."
        actions={<Button variant="outline">Export list</Button>}
      />

      <Tabs items={complianceTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total suppressed" value={formatNumber(suppressionList.length)} />
        <StatCard label="STOP opt-outs" value={formatNumber(stopCount)} />
        <StatCard label="Manual blocks" value={formatNumber(blockedCount)} />
        <StatCard label="Invalid numbers" value={formatNumber(invalidCount)} />
      </div>

      <Card>
        <CardTitle>Suppression entries</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Contact</TH>
              <TH>Phone</TH>
              <TH>Reason</TH>
              <TH>Source</TH>
              <TH>Date</TH>
            </TR>
          </THead>
          <TBody>
            {suppressionList.map((entry) => (
              <TR key={entry.id}>
                <TD className="font-medium">{entry.name}</TD>
                <TD>{formatPhone(entry.phone)}</TD>
                <TD>
                  <StatusChip status={reasonToStatus[entry.reason]} />
                </TD>
                <TD className="text-muted-foreground">{entry.source}</TD>
                <TD className="text-muted-foreground">{entry.date}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="mt-4 text-xs text-muted-foreground">
          Suppressed contacts are automatically excluded from campaigns and automations. STOP replies are processed
          immediately and cannot be overridden.
        </p>
      </Card>
    </div>
  );
}
