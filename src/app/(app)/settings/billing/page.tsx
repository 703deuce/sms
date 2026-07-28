import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { metrics } from "@/lib/mock/data";
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

const invoices = [
  { id: "inv_1", date: "2026-07-01", amount: 79.0, status: "Paid" as const, description: "Growth plan — July 2026" },
  { id: "inv_2", date: "2026-06-01", amount: 79.0, status: "Paid" as const, description: "Growth plan — June 2026" },
  { id: "inv_3", date: "2026-05-01", amount: 47.5, status: "Paid" as const, description: "Growth plan + usage — May 2026" },
];

export default function SettingsBillingPage() {
  return (
    <div>
      <PageHeader
        title="Billing"
        description="Plan, credits, payment method, and invoice history."
        actions={<Button>Add credits</Button>}
      />

      <Tabs items={settingsTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current plan" value="Growth" hint="Trial through Aug 15, 2026" />
        <StatCard label="Account balance" value={formatCurrency(metrics.balance)} />
        <StatCard label="Credits remaining" value={formatNumber(metrics.creditsRemaining)} />
        <StatCard label="Sent this period" value={formatNumber(metrics.messagesSentPeriod)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Payment method</CardTitle>
          <div className="mt-4 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Visa ending in 4242</p>
            <p className="text-xs text-muted-foreground">Expires 08/2028</p>
          </div>
          <Button variant="outline" size="sm" className="mt-4">
            Update payment method
          </Button>
        </Card>

        <Card>
          <CardTitle>Auto-recharge</CardTitle>
          <form className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="autoRecharge" defaultChecked className="rounded border-border" />
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
        <CardTitle>Invoices</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Description</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {invoices.map((inv) => (
              <TR key={inv.id}>
                <TD className="text-muted-foreground">{inv.date}</TD>
                <TD className="font-medium">{inv.description}</TD>
                <TD>{formatCurrency(inv.amount)}</TD>
                <TD>
                  <StatusChip status={inv.status} />
                </TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    Download
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
