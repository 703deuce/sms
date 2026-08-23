import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { loadAdminCustomerById } from "@/lib/admin-data";
import { loadMctbSupportSnapshot } from "@/lib/mctb/admin/support-snapshot";
import { loadPlatformAdminSnapshot } from "@/lib/platform/admin-snapshot";
import { loadDashboardMetrics } from "@/lib/workspace-data";
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
  const customer = await loadAdminCustomerById(id);

  if (!customer) {
    notFound();
  }

  const metrics = await loadDashboardMetrics(id);
  const mctbSnapshot = await loadMctbSupportSnapshot(id);
  const platformSnapshot = await loadPlatformAdminSnapshot(id);
  const usageCost = customer.messages * 0.015;
  const telnyxCost = customer.messages * 0.0085;

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
        description={`${customer.plan} · ${customer.status} · ${customer.memberCount} members`}
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
        <StatCard label="Messages" value={formatNumber(customer.messages)} />
        <StatCard label="Usage revenue" value={formatCurrency(usageCost)} />
        <StatCard label="Telnyx cost" value={formatCurrency(telnyxCost)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <CardTitle>MCTB Support Snapshot</CardTitle>
          </div>
          {mctbSnapshot ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Toll-free</dt>
                <dd className="font-mono text-right">{mctbSnapshot.tollFree.e164 || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">TFV</dt>
                <dd>{mctbSnapshot.tfv.statusLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Service</dt>
                <dd>{mctbSnapshot.mctbServiceStatus}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Trial SMS</dt>
                <dd>
                  {mctbSnapshot.trialSmsSegmentsUsed}
                  {mctbSnapshot.trialSmsSegmentLimit != null
                    ? ` / ${mctbSnapshot.trialSmsSegmentLimit}`
                    : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Onboarding step</dt>
                <dd>{mctbSnapshot.onboarding.currentStep}</dd>
              </div>
              {mctbSnapshot.tfv.failureReason ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-950">
                  TFV: {mctbSnapshot.tfv.failureReason}
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No MCTB data for this workspace.</p>
          )}
        </Card>

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
          <Link href="/admin/a2p" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            View A2P queue →
          </Link>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <CardTitle>Platform product snapshot</CardTitle>
          </div>
          {platformSnapshot ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Entitlements</dt>
                <dd className="text-right">
                  {Object.entries(platformSnapshot.productFeatures)
                    .filter(([, status]) => status === "active" || status === "trial")
                    .map(([key]) => key.replace(/_/g, " "))
                    .join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Smart Routing flows</dt>
                <dd>
                  {platformSnapshot.smartRouting.activeFlows} active /{" "}
                  {platformSnapshot.smartRouting.totalFlows} total
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">SR routing number</dt>
                <dd className="font-mono text-right">
                  {platformSnapshot.smartRouting.routingNumberE164 || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Missed calls (30d)</dt>
                <dd>{formatNumber(platformSnapshot.counts.missedCalls30d)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Link clicks (30d)</dt>
                <dd>{formatNumber(platformSnapshot.counts.linkClicks30d)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Form submissions (30d)</dt>
                <dd>{formatNumber(platformSnapshot.counts.formSubmissions30d)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Voicemails (30d)</dt>
                <dd>{formatNumber(platformSnapshot.counts.voicemails30d)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Open callbacks</dt>
                <dd>{formatNumber(platformSnapshot.counts.callbacksOpen)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No platform snapshot available.</p>
          )}
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
          Workspace slug: <code className="rounded bg-muted px-1">{customer.slug}</code>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm">Reset A2P submission</Button>
          <Button variant="outline" size="sm">Force brand resubmit</Button>
          <Button variant="outline" size="sm">Send compliance notice</Button>
        </div>
      </Card>
    </div>
  );
}
