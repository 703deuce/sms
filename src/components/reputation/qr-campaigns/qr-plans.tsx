"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import { cn } from "@/lib/utils";

type PlanTier = {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
  href: string;
  note?: string;
};

const PLANS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "One active tracked QR campaign with basic scan analytics.",
    features: [
      "1 active QR campaign",
      "Print-ready poster download",
      "Basic scan tracking",
      "Estimated unique visitors",
      "Google review redirect",
    ],
    cta: "Current plan",
    href: "#",
    note: "Free stays free — no credit card required.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "See billing",
    description: "Multiple placements across counters, receipts, vehicles, and more.",
    features: [
      "Up to 20 active QR campaigns",
      "Placement-level analytics",
      "Advanced print formats",
      "Device breakdown",
      "Scan-to-review correlation",
      "Priority support",
    ],
    highlighted: true,
    cta: "Select Plan",
    href: "/settings/subscription",
    note: "Billing uses your existing plan settings.",
  },
  {
    id: "agency",
    name: "Agency",
    price: "See billing",
    description: "Scale QR campaigns across all your client locations.",
    features: [
      "Unlimited active QR campaigns",
      "Multi-client management",
      "White-label poster options",
      "Advanced analytics export",
      "API access",
      "Dedicated account manager",
    ],
    cta: "Select Plan",
    href: "/settings/subscription",
    note: "Billing uses your existing plan settings.",
  },
];

function PlanCard({
  plan,
  businessId,
  isCurrent,
}: {
  plan: PlanTier;
  businessId: string;
  isCurrent?: boolean;
}) {
  void businessId;
  const href = plan.href;

  return (
    <div
      className={cn(
        qrUi.cardPad,
        "relative flex flex-col",
        plan.highlighted && "border-[#16A34A] ring-2 ring-[#16A34A]/20"
      )}
    >
      {plan.highlighted ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#16A34A] px-3 py-0.5 text-[11px] font-semibold text-white">
          Most popular
        </span>
      ) : null}
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#98A2B3]">
        {plan.name}
      </p>
      <p className="mt-2 text-3xl font-bold text-[#0B1B32]">{plan.price}</p>
      <p className="mt-2 text-sm text-[#667085]">{plan.description}</p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-[#344054]">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" />
            {f}
          </li>
        ))}
      </ul>
      {plan.note ? (
        <p className="mt-4 text-xs text-[#98A2B3]">{plan.note}</p>
      ) : null}
      {isCurrent ? (
        <button type="button" disabled className={cn(qrUi.btnSecondary, "mt-5 w-full opacity-60")}>
          Current plan
        </button>
      ) : plan.id === "free" ? (
        <button type="button" disabled className={cn(qrUi.btnSecondary, "mt-5 w-full")}>
          {plan.cta}
        </button>
      ) : (
        <Link
          href={href}
          className={cn(plan.highlighted ? qrUi.btnPrimary : qrUi.btnSecondary, "mt-5 w-full")}
        >
          {plan.cta}
        </Link>
      )}
    </div>
  );
}

export function QrPlans({ businessId }: { businessId: string }) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#027A48]">
          QR Campaign Plans
        </p>
        <h1 className={cn(qrUi.title, "mt-2")}>Choose the right plan for your placements</h1>
        <p className={cn(qrUi.subtitle, "mx-auto max-w-2xl")}>
          Start free with one tracked QR campaign. Upgrade to track scans across multiple
          placements — counters, receipts, vehicles, and more.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            businessId={businessId}
            isCurrent={plan.id === "free"}
          />
        ))}
      </div>

      <p className="text-center text-xs text-[#98A2B3]">
        Pro and Agency plans use your existing billing settings.{" "}
        <Link
          href={`/businesses/${businessId}/reputation/qr-campaigns`}
          className="font-semibold text-[#16A34A] hover:underline"
        >
          Back to campaigns
        </Link>
      </p>
    </div>
  );
}

export function QrUpgradeModal({
  open,
  onClose,
  businessId,
  title = "Upgrade to Pro",
  body = "Free plans include 1 active QR campaign. Upgrade to track scans across multiple placements.",
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  title?: string;
  body?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const plansHref = `/businesses/${businessId}/reputation/qr-campaigns/plans`;
  const settingsHref = "/settings/subscription";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#0B1B32]/60 backdrop-blur-sm"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div className={cn(qrUi.cardPad, "relative z-10 w-full max-w-md shadow-2xl")}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-[#98A2B3] hover:bg-[#F2F4F7] hover:text-[#344054]"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#027A48]">
          Upgrade
        </p>
        <h2 className="mt-1 text-xl font-bold text-[#0B1B32]">{title}</h2>
        <p className="mt-2 text-sm text-[#667085]">{body}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onClose} className={cn(qrUi.btnSecondary, "flex-1")}>
            Stay Free
          </button>
          <Link href={settingsHref} className={cn(qrUi.btnPrimary, "flex-1")}>
            Go Pro
          </Link>
        </div>

        <p className="mt-4 text-center text-xs text-[#98A2B3]">
          <Link href={plansHref} className="font-semibold text-[#16A34A] hover:underline">
            Compare all plans
          </Link>
        </p>
      </div>
    </div>
  );
}
