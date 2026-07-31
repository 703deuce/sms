import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import {
  deriveRequiredActions,
  phoneNumbersSummary,
  tollFreeSummary,
} from "@/lib/compliance-helpers";
import {
  requireWorkspaceContext,
  loadComplianceOverview,
  loadDashboardMetrics,
  loadPhoneNumbers,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Megaphone,
  Phone,
  Shield,
  ShieldCheck,
  ShieldOff,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const quickLinks = [
  {
    title: "Business profile",
    description: "Legal entity and contact details",
    href: "/compliance/business",
    icon: Building2,
    tone: "bg-blue-50 text-blue-600",
  },
  {
    title: "Brand registration",
    description: "10DLC brand identity and vetting",
    href: "/compliance/brand",
    icon: Shield,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    title: "Campaign registration",
    description: "Use case, samples, and opt-in flow",
    href: "/compliance/campaign",
    icon: Megaphone,
    tone: "bg-orange-50 text-orange-600",
  },
  {
    title: "Consent records",
    description: "Proof of opt-in per contact",
    href: "/compliance/consent",
    icon: UserCheck,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Suppression list",
    description: "STOP, blocks, and invalid numbers",
    href: "/compliance/suppression",
    icon: ShieldOff,
    tone: "bg-rose-50 text-rose-600",
  },
];

const requiredActionLinks = [
  "/compliance/brand",
  "/compliance/campaign",
  "/compliance/business",
  "/compliance/check",
  "/numbers",
] as const;

export default async function ComplianceOverviewPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [overview, metrics, phoneNumbers] = await Promise.all([
    loadComplianceOverview(workspaceId),
    loadDashboardMetrics(workspaceId),
    loadPhoneNumbers(workspaceId),
  ]);

  const requiredActions = deriveRequiredActions(overview.registration, phoneNumbers);
  const actionCount = requiredActions.length;
  const phoneSummary = phoneNumbersSummary(phoneNumbers);
  const tollFree = tollFreeSummary(phoneNumbers);

  const statusCards: Array<{
    title: string;
    status: string;
    hint: string;
    href: string;
    icon: LucideIcon;
    tone: string;
  }> = [
    {
      title: "Customer Profile",
      status: overview.customerProfile,
      hint: overview.customerProfile === "Complete" ? "Verified" : "Incomplete",
      href: "/compliance/business",
      icon: Building2,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Brand Registration",
      status: overview.brand,
      hint: overview.brand === "Approved" ? "Approved" : "Action required",
      href: "/compliance/brand",
      icon: Shield,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      title: "Campaign Registration",
      status: overview.campaign,
      hint: overview.campaign === "Approved" ? "Approved" : "Not submitted",
      href: "/compliance/campaign",
      icon: Megaphone,
      tone: "bg-slate-100 text-slate-500",
    },
    {
      title: "Phone Numbers",
      status: phoneNumbers.length ? "Assigned" : "Missing",
      hint: phoneSummary,
      href: "/numbers",
      icon: Phone,
      tone: "bg-blue-50 text-blue-600",
    },
    {
      title: "Toll-Free",
      status: tollFree === "Verified" ? "Approved" : tollFree === "Pending" ? "Pending" : "Draft",
      hint: tollFree,
      href: "/numbers",
      icon: ShieldCheck,
      tone: "bg-violet-50 text-violet-600",
    },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Compliance"
        description="A2P registration, consents, and messaging compliance for your account."
        icon={ShieldCheck}
        iconTone="bg-violet-50 text-violet-600"
        actions={
          <>
            <Link href="/compliance/check">
              <Button variant="outline" className="rounded-[10px]">
                Run readiness check
              </Button>
            </Link>
            <Link href="/compliance/campaign">
              <Button className="rounded-[10px]">
                Continue registration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </>
        }
      />

      <Tabs items={complianceTabs} />

      {metrics.a2pStatus !== "Approved" ? (
        <div className="flex flex-col gap-3 rounded-[12px] border border-amber-200/80 bg-[#fff8e8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-[13px] font-semibold text-amber-950">
                A2P registration is pending
              </p>
              <p className="mt-0.5 text-[12px] text-amber-900/80">
                Complete brand and campaign registration before high-volume sending.
                Unregistered traffic may be filtered or blocked by carriers.
              </p>
            </div>
          </div>
          <Link href="/compliance/campaign">
            <Button
              variant="outline"
              className="h-9 rounded-[10px] border-amber-300 bg-white text-[13px]"
            >
              Register campaign
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="surface block rounded-[12px] bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                    card.tone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <StatusChip status={card.status} />
              </div>
              <p className="mt-3 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                {card.title}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">{card.hint}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Required actions</CardTitle>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
              {actionCount}
            </span>
          </div>
          {actionCount > 0 ? (
            <ul className="mt-4 space-y-2">
              {requiredActions.map((action, i) => (
                <li key={action}>
                  <Link
                    href={requiredActionLinks[i] ?? "/compliance/check"}
                    className="group flex items-start gap-3 rounded-[12px] border border-border p-3 transition hover:border-primary/30 hover:bg-muted/40"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                    <span className="flex-1 text-[13px] text-foreground">{action}</span>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-muted-foreground">
              No pending actions — your registration is complete.
            </p>
          )}
          <Link
            href="/compliance/check"
            className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
          >
            View readiness checklist
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card>
          <CardTitle>Quick links</CardTitle>
          <div className="mt-4 space-y-2">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-3 rounded-[12px] border border-border px-3 py-2.5 transition hover:border-primary/30 hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                      link.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-foreground">
                      {link.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {link.description}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
