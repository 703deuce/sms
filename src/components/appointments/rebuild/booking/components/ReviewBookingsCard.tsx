"use client";

import { useState } from "react";
import { ShieldAlert, ChevronRight, ShieldCheck } from "lucide-react";
import type { SuspiciousBooking } from "../types";

function RiskBadge({ level }: { level: string }) {
  const normalized = level.toUpperCase();
  const tone =
    normalized === "HIGH"
      ? "bg-red-50 text-red-700"
      : normalized === "MEDIUM"
        ? "bg-amber-50 text-amber-700"
        : "bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${tone}`}>
      {normalized}
    </span>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReviewBookingsCard({
  bookings,
}: {
  bookings: SuspiciousBooking[];
}) {
  const [expanded, setExpanded] = useState(false);
  const count = bookings.length;

  return (
    <div className="booking-card">
      <button
        className="flex w-full items-center justify-between text-left"
        type="button"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3">
          <div className="card-icon">
            <ShieldAlert className="h-4 w-4" strokeWidth={1.9} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Review suspicious bookings</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Bookings flagged by AI Booking Protection will appear here for review.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
              count > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {count} to review
          </span>
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
            strokeWidth={1.9}
          />
        </div>
      </button>

      {expanded ? (
        <div className="mt-5 border-t border-[#ececf1] pt-5">
          {count === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#ececf1] bg-[#fafafa] px-6 py-8 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-semibold text-foreground">No suspicious bookings</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                Bookings flagged by AI Booking Protection will appear here for review.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#ececf1] overflow-hidden rounded-xl border border-[#ececf1]">
              {bookings.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col gap-2 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {b.serviceName || "Booking"}{" "}
                      <span className="font-normal text-muted-foreground">· {formatDateTime(b.at)}</span>
                    </p>
                    {b.signals?.length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {b.signals.slice(0, 3).map((signal) => (
                          <span
                            key={signal}
                            className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-medium capitalize text-muted-foreground">
                      {b.action}
                    </span>
                    <RiskBadge level={b.riskLevel} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
