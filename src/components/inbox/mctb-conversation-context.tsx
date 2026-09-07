"use client";

import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { PhoneMissed } from "lucide-react";
import Link from "next/link";

type Props = {
  missedCallEventId: string;
  detectedAt?: string | null;
  repeatCaller?: { missedToday: number; total: number } | null;
};

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Spec 04 — MCTB thread context when viewing shared inbox with product=mctb */
export function MctbConversationContextBanner({
  missedCallEventId,
  detectedAt,
  repeatCaller,
}: Props) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50/70 px-4 py-2.5"
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2 text-[13px] text-indigo-950">
        <PhoneMissed className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
        <div>
          <p className="font-semibold">Started from a missed call</p>
          <p className="text-[12px] text-indigo-900/85">
            {detectedAt ? `Missed ${fmtWhen(detectedAt)}` : "Missed call recovery conversation"}
            {repeatCaller && repeatCaller.missedToday > 1
              ? ` · Called ${repeatCaller.missedToday}× today`
              : null}
          </p>
        </div>
      </div>
      <Link
        href={MCTB_ROUTES.missedCallDetail(missedCallEventId)}
        className="shrink-0 text-[12px] font-semibold text-indigo-700 hover:underline"
      >
        View missed call
      </Link>
    </div>
  );
}
