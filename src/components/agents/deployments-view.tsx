"use client";

import type { DeploymentSummary } from "@/lib/agents/deployments";
import { cn, formatPhone } from "@/lib/utils";
import { Link2, MessageSquare, Phone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

function statusTone(status: string) {
  if (status === "live") return "bg-emerald-50 text-emerald-700";
  if (status === "test") return "bg-sky-50 text-sky-700";
  if (status === "paused") return "bg-amber-50 text-amber-800";
  if (status === "error") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

export function DeploymentsView({
  deployments,
}: {
  deployments: DeploymentSummary[];
}) {
  const [channel, setChannel] = useState<"all" | "voice" | "sms">("all");

  const filtered = useMemo(() => {
    return deployments.filter((d) =>
      channel === "all" ? true : d.channel === channel,
    );
  }, [deployments, channel]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">
          Deployments
        </h1>
        <p className="mt-1.5 max-w-3xl text-[14px] text-[#6B7280]">
          A deployment is what makes an agent live on a number. Create → configure
          → test → choose number → activate. One agent can deploy to many numbers;
          one number can run multiple agents under different routing rules.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["voice", "Voice"],
            ["sms", "SMS"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setChannel(id)}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold",
              channel === id
                ? "bg-[#111827] text-white"
                : "bg-white text-[#4B5563] ring-1 ring-[#E5E7EB]",
            )}
          >
            {label}
          </button>
        ))}
        <Link
          href="/systems"
          className="ml-auto inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold text-[#2563EB] ring-1 ring-[#BFDBFE]"
        >
          My Agents
        </Link>
        <Link
          href="/my-numbers"
          className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold text-[#2563EB] ring-1 ring-[#BFDBFE]"
        >
          My Numbers
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-6 py-16 text-center">
          <p className="text-[14px] font-medium text-[#111827]">
            No deployments yet
          </p>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Create an agent, connect a Transovo number, then activate routing.
            Call forwarding moves voice only — SMS stays on the messaging-ready
            Transovo number.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
          <table className="min-w-full text-left">
            <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">When it runs</th>
                <th className="px-4 py-3">Transovo number</th>
                <th className="px-4 py-3">Customer number</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-semibold text-[#111827]">
                      {d.agentName || d.agentTypeLabel || "Agent"}
                    </p>
                    <p className="text-[12px] text-[#6B7280]">{d.agentTypeLabel}</p>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium text-[#4B5563]">
                    <span className="inline-flex items-center gap-1">
                      {d.channel === "voice" ? (
                        <Phone className="h-3.5 w-3.5" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5" />
                      )}
                      {d.channel.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#4B5563]">
                    {d.scheduleLabel}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#111827]">
                    {d.phoneE164 ? formatPhone(d.phoneE164) : "—"}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#4B5563]">
                    {d.externalE164 ? (
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="h-3.5 w-3.5" />
                        {formatPhone(d.externalE164)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold capitalize",
                        statusTone(d.status),
                      )}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={d.href}
                      className="inline-flex h-8 items-center rounded-md bg-[#111827] px-3 text-[12px] font-semibold text-white"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
