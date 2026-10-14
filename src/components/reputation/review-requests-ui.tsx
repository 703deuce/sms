"use client";

import Link from "next/link";
import { PageHeader, Pill, type Tone } from "@/newui-transplant/components/app/kit";
import { OpusLineTabs } from "@/newui-transplant/components/app/segmented-nav";
import { Button, buttonVariants } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import { OPUS_SEARCH_INPUT } from "@/newui-transplant/components/app/opus-surfaces";
import type { ReviewRequestsSection } from "@/components/reputation/review-requests-sub-tabs";

export function ReviewRequestsPageHeader({
  campaignsHref,
}: {
  campaignsHref?: string;
} = {}) {
  return (
    <PageHeader
      title="Review Requests"
      description="One-time and bulk sends only — choose contacts, channel, template, preview, then send or schedule."
      actions={
        campaignsHref ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={campaignsHref}>Open Campaigns</Link>
          </Button>
        ) : undefined
      }
    />
  );
}

export function ReviewRequestsTopBar() {
  return null;
}

const SECTIONS: Array<{ id: ReviewRequestsSection; label: string }> = [
  { id: "send", label: "One-time request" },
  { id: "bulk", label: "Bulk request" },
  { id: "tracking", label: "Delivery results" },
  { id: "poster", label: "QR / Poster" },
];

export function ReviewRequestsSubTabsBar({
  active,
  onChange,
}: {
  active: ReviewRequestsSection;
  onChange: (section: ReviewRequestsSection) => void;
}) {
  return (
    <OpusLineTabs
      label="Review request sections"
      tabs={SECTIONS.map((s) => ({ value: s.id, label: s.label }))}
      value={active}
      onChange={(id) => onChange(id as ReviewRequestsSection)}
    />
  );
}

function deliveryTone(status: string, hasReply?: boolean): Tone {
  if (hasReply) return "info";
  const key = status.toLowerCase();
  if (key === "failed") return "danger";
  if (key === "pending" || key === "queued") return "warning";
  if (key === "sent" || key === "delivered" || key === "clicked" || key === "completed") return "success";
  return "neutral";
}

const DELIVERY_LABELS: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  clicked: "Clicked",
  completed: "Completed",
  failed: "Failed",
  pending: "Pending",
  queued: "Queued",
};

export function statusPill(status: string, hasReply?: boolean) {
  const label = hasReply ? "Replied" : (DELIVERY_LABELS[status] ?? status);
  return <Pill tone={deliveryTone(status, hasReply)}>{label}</Pill>;
}

export const rrInputClass = OPUS_SEARCH_INPUT;
export const rrLabelClass = "text-sm font-medium text-foreground";
export const rrOutlineBtn = cn(buttonVariants({ variant: "outline" }));
export const rrPrimaryBtn = cn(buttonVariants({ variant: "default" }));

export { Button as rrPrimaryButton, Button as rrOutlineButton };
