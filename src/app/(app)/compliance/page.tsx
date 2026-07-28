import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { complianceOverview, metrics } from "@/lib/mock/data";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

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

const statusItems = [
  { label: "Customer profile", status: complianceOverview.customerProfile, href: "/compliance/business" },
  { label: "Brand registration", status: complianceOverview.brand, href: "/compliance/brand" },
  { label: "Campaign registration", status: complianceOverview.campaign, href: "/compliance/campaign" },
  { label: "Phone numbers (10DLC)", status: complianceOverview.phoneNumbers, href: "/numbers" },
  { label: "Toll-free verification", status: complianceOverview.tollFree, href: "/numbers" },
];

export default function ComplianceOverviewPage() {
  return (
    <div>
      <PageHeader
        title="Compliance"
        description="A2P registration, consent records, and messaging compliance for your account."
        actions={
          <>
            <Link href="/compliance/check">
              <Button variant="outline">Run readiness check</Button>
            </Link>
            <Link href="/compliance/brand">
              <Button>Continue registration</Button>
            </Link>
          </>
        }
      />

      <Tabs items={complianceTabs} />

      {metrics.a2pStatus !== "Approved" ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-medium text-amber-950">A2P registration is {metrics.a2pStatus.toLowerCase()}</p>
              <p className="text-sm text-amber-900/80">
                Complete required actions below before sending at scale. Unregistered traffic may be filtered or
                blocked by carriers.
              </p>
            </div>
          </div>
          <Link href="/compliance/campaign">
            <Button variant="outline" className="border-amber-300 bg-white">
              Register campaign
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statusItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="surface block rounded-xl bg-card p-4 transition hover:border-primary/40"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <div className="mt-2">
              <StatusChip status={item.status} />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Required actions</CardTitle>
          {complianceOverview.requiredActions.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {complianceOverview.requiredActions.map((action) => (
                <li key={action} className="flex gap-3 rounded-lg border border-border p-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  {action}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No pending actions — your registration is complete.</p>
          )}
          <Link href="/compliance/check" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View readiness checklist
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card>
          <CardTitle>Quick links</CardTitle>
          <div className="mt-4 grid gap-2">
            {[
              { title: "Business profile", href: "/compliance/business", desc: "Legal entity and contact details" },
              { title: "Brand registration", href: "/compliance/brand", desc: "10DLC brand identity and vetting" },
              { title: "Campaign registration", href: "/compliance/campaign", desc: "Use case, samples, and opt-in flow" },
              { title: "Consent records", href: "/compliance/consent", desc: "Proof of opt-in per contact" },
              { title: "Suppression list", href: "/compliance/suppression", desc: "STOP, blocks, and invalid numbers" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium">{link.title}</p>
                  <p className="text-xs text-muted-foreground">{link.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
