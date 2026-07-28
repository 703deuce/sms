import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

const numberTabs = [
  { label: "My Numbers", href: "/numbers" },
  { label: "Buy", href: "/numbers/buy" },
  { label: "Port", href: "/numbers/port" },
  { label: "Sender Pools", href: "/numbers/pools" },
];

export default function SenderPoolsPage() {
  return (
    <div>
      <PageHeader
        title="Sender pools"
        description="Group numbers for high-volume sending with carrier-approved distribution."
      />

      <Tabs items={numberTabs} />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-medium text-amber-950">Do not rotate senders to evade filtering</p>
          <p className="mt-1 text-sm text-amber-900/80">
            Sender pools distribute outbound volume across registered numbers for deliverability — not to bypass
            carrier blocks, spam filters, or consent requirements. Misuse may result in number suspension and
            account termination. All numbers in a pool must be registered to the same approved A2P campaign.
          </p>
        </div>
      </div>

      <Card className="border-dashed">
        <div className="flex flex-col items-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <span className="font-display text-lg font-semibold text-muted-foreground">SP</span>
          </div>
          <CardTitle className="mt-4 text-base">Sender pools — coming soon</CardTitle>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Create pools to balance send volume across multiple local numbers tied to one messaging service.
            Available after your A2P campaign is approved.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/compliance/campaign">
              <Button variant="outline">Complete campaign registration</Button>
            </Link>
            <Link href="/numbers/buy">
              <Button>Buy additional numbers</Button>
            </Link>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Planned capabilities</CardTitle>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Sticky sender assignment per contact</li>
            <li>Weighted distribution across pool members</li>
            <li>Automatic failover when a number is throttled</li>
            <li>Per-number usage and deliverability metrics</li>
          </ul>
        </Card>
        <Card>
          <CardTitle>Compliance requirements</CardTitle>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>All pool numbers must share the same approved campaign use case</li>
            <li>Opt-in and opt-out handling must be consistent across the pool</li>
            <li>Pool size must match declared campaign volume in registration</li>
            <li>Numbers cannot be swapped without re-verification</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
