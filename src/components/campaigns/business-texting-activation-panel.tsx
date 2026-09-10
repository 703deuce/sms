"use client";

import Link from "next/link";
import { Megaphone, MessageSquare, Upload, Users } from "lucide-react";
import type { BusinessTextingCampaignStatus } from "@/lib/mass-texting/business-texting-types";

type Props = {
  status: Pick<BusinessTextingCampaignStatus, "active" | "reason" | "phoneE164" | "registrationStatus">;
  variant?: "page" | "banner";
  onDismiss?: () => void;
};

export function BusinessTextingActivationPanel({ status, variant = "page" }: Props) {
  if (status.active) return null;

  const pending =
    status.registrationStatus === "in_review" ||
    status.registrationStatus === "submitted" ||
    (status.reason?.toLowerCase().includes("pending") ?? false);

  const isBanner = variant === "banner";

  return (
    <section
      className={
        isBanner
          ? "mx-8 mb-4 rounded-xl border border-[var(--appt-border,#e5e7eb)] bg-[var(--appt-surface,#fff)] p-5 shadow-sm"
          : "mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center"
      }
      aria-labelledby="business-texting-activation-title"
    >
      <span
        className={`flex items-center justify-center rounded-2xl bg-[var(--appt-brand-accent-soft,#dcefeb)] ring-1 ring-[var(--appt-brand-accent,#147d74)]/20 ${
          isBanner ? "h-10 w-10" : "h-14 w-14"
        }`}
      >
        <Megaphone
          className={`text-[var(--appt-brand-accent,#147d74)] ${isBanner ? "h-5 w-5" : "h-7 w-7"}`}
          aria-hidden
        />
      </span>

      <h2
        id="business-texting-activation-title"
        className={`font-semibold text-[var(--appt-text-primary,#101418)] ${
          isBanner ? "mt-3 text-base" : "mt-6 text-2xl"
        }`}
      >
        Business Texting
      </h2>

      <p
        className={`text-[var(--appt-text-secondary,#6b7280)] ${
          isBanner ? "mt-1 text-sm" : "mt-3 max-w-md text-sm leading-relaxed"
        }`}
      >
        Send promotions, announcements, updates, and rebooking offers to your customer list from your
        business messaging number.
      </p>

      {status.reason ? (
        <p className="mt-2 text-sm text-[var(--appt-state-warning,#b45309)]" role="status">
          {pending ? "Registration in progress" : "Setup required"} — {status.reason}
        </p>
      ) : null}

      <div className={`flex flex-wrap items-center justify-center gap-3 ${isBanner ? "mt-4" : "mt-8"}`}>
        <Link
          href="/settings/messaging"
          className="inline-flex items-center justify-center rounded-lg bg-[var(--appt-brand-accent,#147d74)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--appt-brand-accent-hover,#10665f)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--appt-brand-accent,#147d74)]"
        >
          {pending ? "View registration status" : "Activate Business Texting"}
        </Link>
        {!isBanner ? (
          <Link
            href="/contacts/imports"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--appt-border,#e5e7eb)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--appt-text-primary,#101418)] transition hover:bg-[var(--appt-surface-muted,#f7f8fa)]"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Import contacts
          </Link>
        ) : null}
      </div>

      {!isBanner ? (
        <ul className="mt-10 grid w-full max-w-md gap-3 text-left text-sm text-[var(--appt-text-secondary,#6b7280)]">
          <li className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--appt-brand-accent,#147d74)]" aria-hidden />
            Use your existing Contacts, Segments, and imports
          </li>
          <li className="flex items-start gap-2">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--appt-brand-accent,#147d74)]" aria-hidden />
            Send targeted campaigns to your customer list
          </li>
          <li className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--appt-brand-accent,#147d74)]" aria-hidden />
            Receive replies in Messages → Inbox
          </li>
        </ul>
      ) : null}
    </section>
  );
}

export function BusinessTextingSenderBadge({
  phoneE164,
}: {
  phoneE164: string | null | undefined;
}) {
  if (!phoneE164) return null;
  return (
    <p className="text-sm text-[var(--appt-text-secondary,#6b7280)]">
      Sending from{" "}
      <span className="font-medium tabular-nums text-[var(--appt-text-primary,#101418)]">
        {phoneE164}
      </span>
      <span className="ml-2 inline-flex items-center rounded-full bg-[var(--appt-state-success-soft,#ecfdf3)] px-2 py-0.5 text-xs font-medium text-[var(--appt-state-success,#15803d)]">
        Active
      </span>
    </p>
  );
}
