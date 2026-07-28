import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { adminCustomers, campaigns, metrics } from "@/lib/mock/data";
import { formatNumber, formatPercent } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

const highVolumeAccounts = adminCustomers
  .filter((c) => c.messages > 5000)
  .map((c) => ({
    customer: c.name,
    customerId: c.id,
    messages: c.messages,
    threshold: 5000,
    status: "High" as const,
  }));

const highFailureAccounts = [
  {
    customer: "QuickMove Logistics",
    customerId: "ac_3",
    failureRate: 8.4,
    failed: 748,
    sent: 8900,
    status: "High" as const,
  },
  {
    customer: "Harbor Home Services",
    customerId: "ac_1",
    failureRate: 2.6,
    failed: 41,
    sent: 1580,
    status: "Medium" as const,
  },
];

const highOptOutAccounts = [
  {
    customer: "QuickMove Logistics",
    customerId: "ac_3",
    optOutRate: 2.8,
    optOuts: 249,
    sent: 8900,
    status: "Medium" as const,
  },
];

const prohibitedTerms = [
  {
    id: "pt_1",
    customer: "Metro Auto Sales",
    customerId: "ac_5",
    campaign: "Summer clearance",
    term: "guaranteed approval",
    detected: "2026-07-26T14:00:00Z",
    status: "High" as const,
  },
  {
    id: "pt_2",
    customer: "QuickMove Logistics",
    customerId: "ac_3",
    campaign: "Delivery updates",
    term: "free money",
    detected: "2026-07-24T09:30:00Z",
    status: "Medium" as const,
  },
];

export default function AdminMonitoringPage() {
  const platformOptOut = metrics.optOutRate;
  const failedCampaigns = campaigns.filter((c) => c.status === "Failed").length;

  return (
    <div>
      <PageHeader
        title="Message monitoring"
        description="Accounts flagged for high volume, delivery failures, opt-out rates, and prohibited content."
        actions={<Button variant="outline">Configure thresholds</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="High volume accounts" value={formatNumber(highVolumeAccounts.length)} />
        <StatCard label="High failure accounts" value={formatNumber(highFailureAccounts.length)} />
        <StatCard label="High opt-out accounts" value={formatNumber(highOptOutAccounts.length)} />
        <StatCard label="Prohibited term hits" value={formatNumber(prohibitedTerms.length)} />
      </div>

      <Card className="mb-4">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <CardTitle>High volume</CardTitle>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Customer</TH>
              <TH>Messages (30d)</TH>
              <TH>Threshold</TH>
              <TH>Severity</TH>
            </TR>
          </THead>
          <TBody>
            {highVolumeAccounts.map((row) => (
              <TR key={row.customerId}>
                <TD>
                  <Link
                    href={`/admin/customers/${row.customerId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.customer}
                  </Link>
                </TD>
                <TD>{formatNumber(row.messages)}</TD>
                <TD className="text-muted-foreground">{formatNumber(row.threshold)}+</TD>
                <TD>
                  <StatusChip status={row.status} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>High failure rate</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Failed</TH>
                <TH>Sent</TH>
                <TH>Rate</TH>
              </TR>
            </THead>
            <TBody>
              {highFailureAccounts.map((row) => (
                <TR key={row.customerId}>
                  <TD>
                    <Link
                      href={`/admin/customers/${row.customerId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.customer}
                    </Link>
                  </TD>
                  <TD>{formatNumber(row.failed)}</TD>
                  <TD>{formatNumber(row.sent)}</TD>
                  <TD>
                    <StatusChip status={row.status} />
                    <span className="ml-2">{formatPercent(row.failureRate)}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardTitle>High opt-out rate</CardTitle>
          <p className="mt-2 text-xs text-muted-foreground">
            Platform average: {formatPercent(platformOptOut)} · Failed campaigns: {failedCampaigns}
          </p>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Opt-outs</TH>
                <TH>Sent</TH>
                <TH>Rate</TH>
              </TR>
            </THead>
            <TBody>
              {highOptOutAccounts.map((row) => (
                <TR key={row.customerId}>
                  <TD>
                    <Link
                      href={`/admin/customers/${row.customerId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.customer}
                    </Link>
                  </TD>
                  <TD>{formatNumber(row.optOuts)}</TD>
                  <TD>{formatNumber(row.sent)}</TD>
                  <TD>
                    <StatusChip status={row.status} />
                    <span className="ml-2">{formatPercent(row.optOutRate)}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Prohibited terms detected</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Customer</TH>
              <TH>Campaign</TH>
              <TH>Term</TH>
              <TH>Detected</TH>
              <TH>Severity</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {prohibitedTerms.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={`/admin/customers/${row.customerId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.customer}
                  </Link>
                </TD>
                <TD>{row.campaign}</TD>
                <TD className="font-mono text-sm text-red-700">{row.term}</TD>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {new Date(row.detected).toLocaleString()}
                </TD>
                <TD>
                  <StatusChip status={row.status} />
                </TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    Review
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
