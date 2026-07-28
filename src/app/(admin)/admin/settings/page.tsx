import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

const pricingPlans = [
  {
    id: "plan_starter",
    name: "Starter",
    price: 29,
    messages: 500,
    numbers: 1,
    status: "Active" as const,
  },
  {
    id: "plan_growth",
    name: "Growth",
    price: 79,
    messages: 2500,
    numbers: 3,
    status: "Active" as const,
  },
  {
    id: "plan_pro",
    name: "Pro",
    price: 149,
    messages: 10000,
    numbers: 10,
    status: "Active" as const,
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    price: 0,
    messages: 0,
    numbers: 0,
    status: "Draft" as const,
  },
];

const featureFlags = [
  { id: "ff_ai_templates", name: "AI template generator", enabled: true },
  { id: "ff_mms", name: "MMS messaging", enabled: true },
  { id: "ff_automations_v2", name: "Automations v2 builder", enabled: false },
  { id: "ff_hubspot", name: "HubSpot integration", enabled: false },
  { id: "ff_advanced_reports", name: "Advanced reporting", enabled: true },
];

export default function AdminSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Platform settings"
        description="Pricing plans, trial limits, feature flags, and maintenance mode."
        actions={<Button>Save changes</Button>}
      />

      <Card className="mb-4">
        <CardTitle>Pricing plans</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Plan</TH>
              <TH>Monthly price</TH>
              <TH>Included messages</TH>
              <TH>Numbers</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {pricingPlans.map((plan) => (
              <TR key={plan.id}>
                <TD className="font-medium">{plan.name}</TD>
                <TD>{plan.price > 0 ? formatCurrency(plan.price) : "Custom"}</TD>
                <TD>{plan.messages > 0 ? formatNumber(plan.messages) : "Unlimited"}</TD>
                <TD>{plan.numbers > 0 ? formatNumber(plan.numbers) : "Unlimited"}</TD>
                <TD>
                  <StatusChip status={plan.status} />
                </TD>
                <TD className="text-right">
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Trial limits</CardTitle>
          <form className="mt-4 space-y-4">
            <div>
              <Label htmlFor="trialDays">Trial duration (days)</Label>
              <Input id="trialDays" type="number" defaultValue={14} />
            </div>
            <div>
              <Label htmlFor="trialMessages">Trial message limit</Label>
              <Input id="trialMessages" type="number" defaultValue={500} />
            </div>
            <div>
              <Label htmlFor="trialNumbers">Trial numbers allowed</Label>
              <Input id="trialNumbers" type="number" defaultValue={1} />
            </div>
            <div>
              <Label htmlFor="trialCredits">Starting credits</Label>
              <Input id="trialCredits" type="number" defaultValue={25} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="requireCard" defaultChecked className="rounded border-border" />
              <Label htmlFor="requireCard" className="mb-0">
                Require payment method at signup
              </Label>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Maintenance mode</CardTitle>
          <form className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium">Enable maintenance mode</p>
                <p className="text-xs text-muted-foreground">
                  Blocks new signups and shows a status page to users.
                </p>
              </div>
              <input type="checkbox" id="maintenanceMode" className="rounded border-border" />
            </div>
            <div>
              <Label htmlFor="maintenanceMessage">Status message</Label>
              <textarea
                id="maintenanceMessage"
                className="flex min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                defaultValue="We're performing scheduled maintenance. Expected completion: 30 minutes."
              />
            </div>
            <div>
              <Label htmlFor="allowedIps">Allowed IP addresses (admin bypass)</Label>
              <Input id="allowedIps" placeholder="203.0.113.0, 198.51.100.0" />
            </div>
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Feature flags</CardTitle>
        <ul className="mt-4 divide-y divide-border">
          {featureFlags.map((flag) => (
            <li key={flag.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{flag.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{flag.id}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusChip status={flag.enabled ? "Active" : "Paused"} />
                <Select defaultValue={flag.enabled ? "on" : "off"} className="w-24">
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
