"use client";

import type {
  SystemResource,
  SystemStatus,
  SystemType,
} from "@/lib/systems/load-systems";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const TYPE_FILTERS: Array<{ id: "all" | SystemType; label: string }> = [
  { id: "all", label: "All" },
  { id: "solution_setup", label: "Solution Setups" },
  { id: "ai_agent", label: "AI Agents" },
  { id: "automation", label: "Automations" },
  { id: "campaign", label: "Campaigns" },
];

const STATUS_FILTERS: Array<{ id: "all" | SystemStatus; label: string }> = [
  { id: "all", label: "All statuses" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "paused", label: "Paused" },
  { id: "needs_attention", label: "Needs Attention" },
];

function StatusPill({ status, label }: { status: SystemStatus; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold",
        status === "active" && "bg-emerald-50 text-emerald-700",
        status === "draft" && "bg-slate-100 text-slate-600",
        status === "paused" && "bg-amber-50 text-amber-700",
        status === "needs_attention" && "bg-rose-50 text-rose-700",
      )}
    >
      {label}
    </span>
  );
}

function SystemRow({
  system,
  depth = 0,
}: {
  system: SystemResource;
  depth?: number;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = Boolean(system.children?.length);

  return (
    <>
      <tr className="border-b border-[#E5E7EB] last:border-0">
        <td className="px-4 py-3" style={{ paddingLeft: 16 + depth * 20 }}>
          <div className="flex items-start gap-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-0.5 rounded p-0.5 text-[#9CA3AF] hover:bg-slate-100 hover:text-[#111827]"
                aria-label={open ? "Collapse" : "Expand"}
              >
                {open ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="mt-0.5 w-5" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#111827]">
                {system.name}
              </p>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">
                Created from: {system.createdFrom}
              </p>
              {system.warning ? (
                <p className="mt-1 text-[12px] font-medium text-rose-600">
                  {system.warning}
                </p>
              ) : null}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-[12px] font-medium text-[#4B5563]">
          {system.typeLabel}
        </td>
        <td className="px-4 py-3">
          <StatusPill status={system.status} label={system.statusLabel} />
        </td>
        <td className="px-4 py-3 text-[12px] text-[#6B7280]">
          {system.channels.join(", ") || "—"}
        </td>
        <td className="px-4 py-3 text-[12px] text-[#6B7280]">
          {system.phoneNumber || "—"}
        </td>
        <td className="px-4 py-3 text-[12px] text-[#6B7280]">
          {system.lastActivity || "—"}
        </td>
        <td className="px-4 py-3 text-[12px] text-[#6B7280]">
          {system.nextAction || "—"}
        </td>
        <td className="px-4 py-3 text-right">
          <Link
            href={system.href}
            className="inline-flex h-8 items-center rounded-md bg-[#3B82F6] px-3 text-[12px] font-semibold text-white hover:bg-[#2563EB]"
          >
            Open
          </Link>
        </td>
      </tr>
      {open && hasChildren
        ? system.children!.map((child) => (
            <SystemRow key={child.id} system={child} depth={depth + 1} />
          ))
        : null}
    </>
  );
}

export function MySystemsView({ systems }: { systems: SystemResource[] }) {
  const [typeFilter, setTypeFilter] = useState<"all" | SystemType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | SystemStatus>("all");

  const filtered = useMemo(() => {
    return systems.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [systems, typeFilter, statusFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">
          My Systems
        </h1>
        <p className="mt-1.5 text-[14px] text-[#6B7280]">
          Everything created through a solution, template, builder, or manual
          setup — in one inventory.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTypeFilter(f.id)}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold transition",
              typeFilter === f.id
                ? "bg-[#111827] text-white"
                : "bg-white text-[#4B5563] ring-1 ring-[#E5E7EB] hover:bg-slate-50",
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-[#E5E7EB]" />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold transition",
              statusFilter === f.id
                ? "bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#BFDBFE]"
                : "bg-white text-[#4B5563] ring-1 ring-[#E5E7EB] hover:bg-slate-50",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Channels</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3">Next action</th>
                <th className="px-4 py-3 text-right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-[13px] text-[#6B7280]"
                  >
                    No systems match these filters yet. Set up a solution from
                    the dashboard to populate this inventory.
                  </td>
                </tr>
              ) : (
                filtered.map((system) => (
                  <SystemRow key={system.id} system={system} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
