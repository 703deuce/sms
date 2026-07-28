import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { adminCustomers } from "@/lib/mock/data";
import { formatCurrency, formatNumber } from "@/lib/utils";

const subscriptionPayments = [
  {
    id: "pay_1",
    customer: "BrightPath Dental",
    customerId: "ac_2",
    date: "2026-07-01",
    amount: 149,
    plan: "Pro",
    status: "Paid" as const,
  },
  {
    id: "pay_2",
    customer: "QuickMove Logistics",
    customerId: "ac_3",
    date: "2026-07-01",
    amount: 79,
    plan: "Growth",
    status: "Paid" as const,
  },
  {
    id: "pay_3",
    customer: "Harbor Home Services",
    customerId: "ac_1",
    date: "2026-07-01",
    amount: 0,
    plan: "Growth (Trial)",
    status: "Trial" as const,
  },
];

const usageCharges = adminCustomers
  .filter((c) => c.messages > 0)
  .map((c) => ({
    customer: c.name,
    customerId: c.id,
    messages: c.messages,
    segments: Math.round(c.messages * 1.04),
    revenue: c.messages * 0.015,
    twilioCost: c.messages * 0.0085,
    margin: c.messages * 0.0065,
  }));

export default function AdminBillingPage() {
  const mrr = adminCustomers.reduce((sum, c) => sum + c.mrr, 0);
  const totalMessages = adminCustomers.reduce((sum, c) => sum + c.messages, 0);
  const totalRevenue = usageCharges.reduce((sum, c) => sum + c.revenue, 0) + mrr;
  const totalTwilioCost = usageCharges.reduce((sum, c) => sum + c.twilioCost, 0);
  const grossMargin = totalRevenue - totalTwilioCost;

  return (
    <div>
      <PageHeader
        title="Platform billing"
        description="Subscription payments, usage charges, and Twilio cost vs revenue analysis."
        actions={<Button variant="outline">Download report</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR" value={formatCurrency(mrr)} />
        <StatCard label="Usage revenue" value={formatCurrency(totalRevenue - mrr)} />
        <StatCard label="Twilio cost" value={formatCurrency(totalTwilioCost)} />
        <StatCard label="Gross margin" value={formatCurrency(grossMargin)} hint={`${formatNumber(totalMessages)} messages`} />
      </div>

      <Card className="mb-4">
        <CardTitle>Subscription payments</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Customer</TH>
              <TH>Plan</TH>
              <TH>Date</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {subscriptionPayments.map((payment) => (
              <TR key={payment.id}>
                <TD className="font-medium">{payment.customer}</TD>
                <TD className="text-muted-foreground">{payment.plan}</TD>
                <TD>{new Date(payment.date).toLocaleDateString()}</TD>
                <TD>{formatCurrency(payment.amount)}</TD>
                <TD>
                  <StatusChip status={payment.status} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardTitle>Usage charges — Twilio cost vs revenue</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Customer</TH>
              <TH>Messages</TH>
              <TH>Segments</TH>
              <TH>Revenue</TH>
              <TH>Twilio cost</TH>
              <TH>Margin</TH>
            </TR>
          </THead>
          <TBody>
            {usageCharges.map((row) => (
              <TR key={row.customerId}>
                <TD className="font-medium">{row.customer}</TD>
                <TD>{formatNumber(row.messages)}</TD>
                <TD>{formatNumber(row.segments)}</TD>
                <TD>{formatCurrency(row.revenue)}</TD>
                <TD>{formatCurrency(row.twilioCost)}</TD>
                <TD className="text-emerald-700">{formatCurrency(row.margin)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
