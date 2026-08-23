"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReviewRequestsSection } from "@/components/reputation/review-requests-sub-tabs";
import {
  ModuleHeader,
  TabBar,
  btnPrimary,
  btnSecondary,
  inputClass,
  fieldLabelClass,
} from "@/components/ui/design-system";

export function ReviewRequestsPageHeader({
  campaignsHref,
}: {
  campaignsHref?: string;
} = {}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <ModuleHeader
        title="Review Requests"
        subtitle="One-time and bulk sends only — choose contacts, channel, template, preview, then send or schedule."
        className="[&_h1]:text-xl [&_p]:text-[13px] [&_p]:leading-snug"
      />
      {campaignsHref ? (
        <Link
          href={campaignsHref}
          className="mb-1 inline-flex items-center rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Open Campaigns →
        </Link>
      ) : null}
    </div>
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
    <TabBar
      tabs={SECTIONS}
      active={active}
      onChange={onChange}
      className="[&_button]:pb-2.5 [&_button]:text-[13px] [&>div]:gap-4"
    />
  );
}

export function statusPill(status: string, hasReply?: boolean) {
  if (hasReply) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Replied
      </span>
    );
  }
  const styles: Record<string, { pill: string; dot: string }> = {
    sent: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100", dot: "bg-emerald-500" },
    delivered: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100", dot: "bg-emerald-500" },
    clicked: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100", dot: "bg-emerald-500" },
    completed: { pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100", dot: "bg-emerald-500" },
    failed: { pill: "bg-red-50 text-red-700 ring-1 ring-red-100", dot: "bg-red-500" },
    pending: { pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-100", dot: "bg-amber-500" },
    queued: { pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-100", dot: "bg-amber-500" },
  };
  const labels: Record<string, string> = {
    sent: "Sent",
    delivered: "Delivered",
    clicked: "Clicked",
    completed: "Completed",
    failed: "Failed",
    pending: "Pending",
    queued: "Queued",
  };
  const key = status in styles ? status : "pending";
  const s = styles[key]!;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", s.pill)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {labels[key] ?? status}
    </span>
  );
}

export { inputClass as rrInputClass };
export { fieldLabelClass as rrLabelClass };
export { btnSecondary as rrOutlineBtn };
export { btnPrimary as rrPrimaryBtn };
