"use client";

import type { NumberRoutingRow } from "@/lib/numbers/load-my-numbers";
import { cn, formatPhone } from "@/lib/utils";
import { Phone } from "lucide-react";
import Link from "next/link";

function eventLabel(eventType: string) {
  switch (eventType) {
    case "every_call":
      return "Every inbound call";
    case "overflow":
      return "Overflow / unanswered";
    case "after_hours":
      return "After hours";
    case "unanswered":
      return "Unanswered";
    default:
      return eventType;
  }
}

export function MyNumbersView({
  rows,
  summary,
}: {
  rows: NumberRoutingRow[];
  summary: { numbers: number; live: number; paused: number };
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">
          My Numbers
        </h1>
        <p className="mt-1.5 max-w-3xl text-[14px] text-[#6B7280]">
          Global view of trigger deployments. Edit routing on the workflow
          canvas (Inbound Call trigger). Activate publishes Telnyx routing;
          pause applies the fallback you configured on the trigger.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-[13px] text-[#4B5563]">
        <span className="rounded-full bg-[#F3F4F6] px-3 py-1 font-medium">
          {summary.numbers} numbers
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
          {summary.live} live routes
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800">
          {summary.paused} paused
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-6 py-16 text-center">
          <p className="text-[14px] font-medium text-[#111827]">No numbers yet</p>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Add a Transovo number, then put it on an Inbound Call trigger and
            Activate the workflow.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <article
              key={row.phoneNumberId}
              className="rounded-xl border border-[#E5E7EB] bg-white p-5"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold text-[#111827]">
                    {formatPhone(row.e164)}
                  </h2>
                  <p className="text-[12px] text-[#6B7280]">{row.displayName}</p>
                </div>
              </div>

              {row.routes.length === 0 ? (
                <p className="mt-4 text-[13px] text-[#6B7280]">
                  No agent workflow attached. Open a workflow, set this number
                  on the Inbound Call trigger, then Activate.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {row.routes.map((r) => (
                    <li
                      key={r.deploymentId}
                      className="flex items-start justify-between gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2 text-[12px]"
                    >
                      <div>
                        <p className="font-semibold text-[#111827]">
                          {eventLabel(r.eventType)}
                        </p>
                        <Link
                          href={r.href}
                          className="text-[#2563EB] hover:underline"
                        >
                          → {r.flowName}
                        </Link>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          r.status === "live" &&
                            "bg-emerald-50 text-emerald-700",
                          r.status === "paused" &&
                            "bg-amber-50 text-amber-800",
                          r.status === "test" && "bg-sky-50 text-sky-700",
                          r.status === "error" && "bg-rose-50 text-rose-700",
                          !["live", "paused", "test", "error"].includes(
                            r.status,
                          ) && "bg-slate-100 text-slate-600",
                        )}
                      >
                        {r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
