import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { adminCustomers, metrics } from "@/lib/mock/data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { ArrowLeft, CreditCard, Shield, UserCog } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = adminCustomers.find((c) => c.id === id);

  if (!customer) {
    notFound();
  }

  const usageCost = customer.messages * 0.015;
  const twilioCost = customer.messages * 0.0085;

  return (
    <div>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <PageHeader
        title={customer.name}
        description={`${customer.plan} plan · ${customer.status} account`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <UserCog className="h-4 w-4" />
              Impersonate
            </Button>
            <Button variant="outline" size="sm">
              <CreditCard className="h-4 w-4" />
              Add credit
            </Button>
            <Button variant="danger" size="sm">
              Suspend account
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <StatusChip status={customer.status} />
        <StatusChip status={customer.a2p} />
        <StatusChip status={customer.risk} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR" value={formatCurrency(customer.mrr)} />
        <StatCard label="Messages (30d)" value={formatNumber(customer.messages)} />
        <StatCard label="Usage revenue" value={formatCurrency(usageCost)} />
        <StatCard label="Twilio cost" value={formatCurrency(twilioCost)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <CardTitle>Compliance</CardTitle>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">A2P brand</dt>
              <dd>
                <StatusChip status={customer.a2p} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Risk level</dt>
              <dd>
                <StatusChip status={customer.risk} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Opt-out rate</dt>
              <dd>{formatPercent(metrics.optOutRate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery rate</dt>
              <dd>{formatPercent(metrics.deliveryRate)}</dd>
            </div>
          </dl>
          <Link
            href="/admin/a2p"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            View A2P queue →
          </Link>
        </Card>

        <Card>
          <CardTitle>Usage summary</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Metric</TH>
                <TH>Value</TH>
              </TR>
            </THead>
            <TBody>
              <TR>
                <TD>Messages sent</TD>
                <TD>{formatNumber(customer.messages)}</TD>
              </TR>
              <TR>
                <TD>SMS segments (est.)</TD>
                <TD>{formatNumber(Math.round(customer.messages * 1.04))}</TD>
              </TR>
              <TR>
                <TD>MMS messages</TD>
                <TD>{formatNumber(Math.round(customer.messages * 0.008))}</TD>
              </TR>
              <TR>
                <TD>Credits remaining</TD>
                <TD>{formatNumber(metrics.creditsRemaining)}</TD>
              </TR>
              <TR>
                <TD>Account balance</TD>
                <TD>{formatCurrency(metrics.balance)}</TD>
              </TR>
            </TBody>
          </Table>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Admin actions</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          These actions are UI-only in this demo. In production they would trigger account state changes,
          billing adjustments, and audit log entries.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            Reset A2P submission
          </Button>
          <Button variant="outline" size="sm">
            Force brand resubmit
          </Button>
          <Button variant="outline" size="sm">
            Send compliance notice
          </Button>
          <Button variant="outline" size="sm">
            View message logs
          </Button>
        </div>
      </Card>
    </div>
  );
}
