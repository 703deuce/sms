import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import {
  loadDashboardMetrics,
  loadRegistration,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

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

export default async function SettingsLimitsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [metrics, registration] = await Promise.all([
    loadDashboardMetrics(workspaceId),
    loadRegistration(workspaceId),
  ]);

  const a2pApproved = metrics.a2pStatus === "Approved";
  const dailyCap = a2pApproved ? 10000 : 200;
  const monthlyCap = a2pApproved ? 250000 : 5000;
  const sentToday = Math.round(metrics.messagesSentPeriod / 30);

  return (
    <div>
      <PageHeader
        title="Usage limits"
        description="Account-level send caps, rate limits, and approval thresholds."
        actions={<Button>Save limits</Button>}
      />

      <Tabs items={settingsTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Daily send cap" value={formatNumber(dailyCap)} hint="Segments per day" />
        <StatCard label="Sent today (est.)" value={formatNumber(sentToday)} />
        <StatCard label="Monthly cap" value={formatNumber(monthlyCap)} hint="Segments per month" />
        <StatCard label="A2P throughput" value={a2pApproved ? "60 MPS" : "1 MPS"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Campaign limits</CardTitle>
          <form className="mt-4 space-y-4">
            <div>
              <Label htmlFor="maxAudience">Max audience per campaign</Label>
              <Input id="maxAudience" type="number" defaultValue={a2pApproved ? 50000 : 5000} />
            </div>
            <div>
              <Label htmlFor="approvalThreshold">Require approval above</Label>
              <Input id="approvalThreshold" type="number" defaultValue={a2pApproved ? 5000 : 500} />
              <p className="mt-1 text-xs text-muted-foreground">
                Campaigns exceeding this size require owner approval before send.
              </p>
            </div>
            <div>
              <Label htmlFor="dailyCap">Daily segment cap</Label>
              <Input id="dailyCap" type="number" defaultValue={dailyCap} />
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Rate limits</CardTitle>
          <form className="mt-4 space-y-4">
            <div>
              <Label htmlFor="inboxRate">Inbox messages per minute</Label>
              <Input id="inboxRate" type="number" defaultValue={30} />
            </div>
            <div>
              <Label htmlFor="apiRate">API requests per minute</Label>
              <Input id="apiRate" type="number" defaultValue={120} />
            </div>
            <div>
              <Label htmlFor="importBatch">Max import batch size</Label>
              <Select id="importBatch" defaultValue="10000">
                <option value="5000">5,000 contacts</option>
                <option value="10000">10,000 contacts</option>
                <option value="50000">50,000 contacts</option>
              </Select>
            </div>
          </form>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>A2P registration impact</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Your current A2P status is <strong>{metrics.a2pStatus}</strong>. Approved registration unlocks higher
          throughput and daily caps. Unregistered accounts are limited to 200 segments per day.
        </p>
        {registration?.useCase ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Registered use case: {registration.useCase}
          </p>
        ) : null}
        <Link href="/compliance" className="mt-4 inline-flex">
          <Button variant="outline" size="sm">
            View compliance status
          </Button>
        </Link>
      </Card>
    </div>
  );
}
