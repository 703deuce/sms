import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import {
  requireWorkspaceContext,
  loadComplianceOverview,
  loadDashboardMetrics,
  loadPhoneNumbers,
} from "@/lib/workspace-data";
import { isPhoneMessagingApproved } from "@/lib/messaging/compliance/messaging-compliance";
import {
  isApprovedMessagingStatus,
  isHpCertifiedSmsNumber,
  pickPreferredSmsSendingNumber,
} from "@/lib/messaging/preferred-sending-number";
import type { PhoneNumber } from "@/lib/types";
import { CheckCircle2, XCircle } from "lucide-react";
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

type CheckItem = {
  label: string;
  pass: boolean;
  detail: string;
  href?: string;
};

export default async function ComplianceCheckPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [overview, metrics, phoneNumbers] = await Promise.all([
    loadComplianceOverview(workspaceId),
    loadDashboardMetrics(workspaceId),
    loadPhoneNumbers(workspaceId),
  ]);

  const samples = overview.registration?.sampleMessages || [];
  const privacyUrl = overview.website
    ? `${overview.website.replace(/\/$/, "")}/privacy`
    : "";

  const activeNumbers = phoneNumbers.filter((pn: PhoneNumber) => pn.status === "Active");
  const preferredSending = pickPreferredSmsSendingNumber(activeNumbers);
  const sendingNumberReady = Boolean(
    preferredSending &&
      (isHpCertifiedSmsNumber(preferredSending.number) ||
        isPhoneMessagingApproved(preferredSending) ||
        isApprovedMessagingStatus(preferredSending.a2pStatus)),
  );
  const sendingDetail = preferredSending
    ? `${preferredSending.number}${sendingNumberReady ? " · messaging-ready" : " · pending"}`
    : "No active sending number";

  const checklist: CheckItem[] = [
    {
      label: "Business profile complete",
      pass: overview.customerProfile === "Complete",
      detail: "Legal name, EIN, address, and contacts on file",
      href: "/compliance/business",
    },
    {
      label: "Brand registration approved",
      pass: overview.brand === "Approved",
      detail: `Current status: ${overview.brand}`,
      href: "/compliance/brand",
    },
    {
      label: "Campaign registration submitted",
      pass: overview.campaign !== "Draft",
      detail: `Current status: ${overview.campaign}`,
      href: "/compliance/campaign",
    },
    {
      label: "Privacy policy URL provided",
      pass: Boolean(overview.website),
      detail: privacyUrl || "Required for brand vetting",
      href: "/compliance/brand",
    },
    {
      label: "Sample messages provided (2+)",
      pass: samples.length >= 2,
      detail: `${samples.length} sample message(s) on file`,
      href: "/compliance/campaign",
    },
    {
      label: "Opt-in disclosure on website",
      pass: Boolean(overview.registration?.optInDescription),
      detail: "Consent language must match registered message flow",
      href: "/grow/forms",
    },
    {
      label: "Active phone number assigned",
      pass: phoneNumbers.length > 0 || Boolean(overview.registration?.phoneE164),
      detail: `${phoneNumbers.length} number(s) on account`,
      href: "/numbers",
    },
    {
      label: "Sending number messaging-ready",
      pass: sendingNumberReady,
      detail: sendingDetail,
      href: "/numbers",
    },
    {
      label: "Payment method on file",
      pass: metrics.balance > 0,
      detail: `Balance: $${metrics.balance.toFixed(2)}`,
      href: "/settings/billing",
    },
    {
      label: "STOP handling configured",
      pass: true,
      detail: "Automatic opt-out processing enabled",
      href: "/settings/messaging",
    },
  ];

  const passed = checklist.filter((item) => item.pass).length;
  const total = checklist.length;
  const ready = passed === total;

  return (
    <div>
      <PageHeader
        title="Registration readiness"
        description="Pre-flight checklist before your first high-volume campaign send."
        actions={
          ready ? (
            <StatusChip status="Complete" />
          ) : (
            <Link href="/compliance/brand">
              <Button>Fix pending items</Button>
            </Link>
          )
        }
      />

      <Tabs items={complianceTabs} />

      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Readiness score</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {passed} of {total} checks passed
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold text-primary">
              {Math.round((passed / total) * 100)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {ready ? "Ready to send" : "Action required"}
            </p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(passed / total) * 100}%` }}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Checklist</CardTitle>
        <ul className="mt-4 divide-y divide-border">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
              {item.pass ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.label}</p>
                  <StatusChip status={item.pass ? "Complete" : "Pending"} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                {item.href && !item.pass ? (
                  <Link
                    href={item.href}
                    className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
                  >
                    Resolve →
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
