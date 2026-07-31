import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import {
  loadDashboardMetrics,
  loadUsage,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { formatCurrency, formatNumber } from "@/lib/utils";

const settingsTabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Users", href: "/settings/users" },
  { label: "Workspaces", href: "/settings/workspaces" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Limits", href: "/settings/limits" },
  { label: "Security", href: "/settings/security" },
  { label: "Branding", href: "/settings/branding" },
  { label: "Data", href: "/settings/data" },
];

export default async function SettingsBillingPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [metrics, usage] = await Promise.all([
    loadDashboardMetrics(workspaceId),
    loadUsage(workspaceId),
  ]);

  const currentUsage = usage[0];

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Plan, credits, payment method, and invoice history."
        actions={<Button>Add credits</Button>}
      />

      <Tabs items={settingsTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current plan" value="Growth" hint="Workspace billing" />
        <StatCard label="Account balance" value={formatCurrency(metrics.balance)} />
        <StatCard label="Credits remaining" value={formatNumber(metrics.creditsRemaining)} />
        <StatCard label="Sent this period" value={formatNumber(metrics.messagesSentPeriod)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Payment method</CardTitle>
          <div className="mt-4 rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">No payment method on file.</p>
          </div>
          <Button variant="outline" size="sm" className="mt-4">
            Update payment method
          </Button>
        </Card>

        <Card>
          <CardTitle>Auto-recharge</CardTitle>
          <form className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="autoRecharge" className="rounded border-border" />
              <Label htmlFor="autoRecharge" className="mb-0">
                Enable auto-recharge when balance is low
              </Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="rechargeThreshold">Recharge when below</Label>
                <Select id="rechargeThreshold" defaultValue="25">
                  <option value="10">$10.00</option>
                  <option value="25">$25.00</option>
                  <option value="50">$50.00</option>
                  <option value="100">$100.00</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="rechargeAmount">Recharge amount</Label>
                <Select id="rechargeAmount" defaultValue="50">
                  <option value="25">$25.00</option>
                  <option value="50">$50.00</option>
                  <option value="100">$100.00</option>
                  <option value="250">$250.00</option>
                </Select>
              </div>
            </div>
            <Button type="button" size="sm">
              Save auto-recharge
            </Button>
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Add credits</CardTitle>
        <form className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="creditAmount">Amount</Label>
            <Input id="creditAmount" type="number" defaultValue={50} min={10} step={5} className="w-32" />
          </div>
          <Button type="button">Purchase credits</Button>
        </form>
      </Card>

      <Card className="mt-4">
        <CardTitle>Usage periods</CardTitle>
        {usage.length === 0 ? (
          <EmptyState
            title="No usage records"
            description="Usage will appear here once you send messages."
          />
        ) : (
          <div className="mt-4 space-y-3">
            {usage.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
              >
                <span className="text-muted-foreground">
                  {new Date(row.periodStart).toLocaleDateString()} – {new Date(row.periodEnd).toLocaleDateString()}
                </span>
                <span>
                  {formatNumber(row.outbound)} outbound · {formatCurrency(row.costCents / 100)}
                </span>
              </div>
            ))}
          </div>
        )}
        {currentUsage ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Current period: {formatNumber(currentUsage.smsSegments)} SMS segments, {formatNumber(currentUsage.mmsMessages)} MMS.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
