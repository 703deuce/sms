"use client";

import type {
  SystemResource,
  SystemStatus,
  SystemType,
} from "@/lib/systems/load-systems";
import { cn } from "@/lib/utils";
import {
  AudioLines,
  MessageSquare,
  Megaphone,
  Phone,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const TYPE_FILTERS: Array<{ id: "all" | SystemType; label: string }> = [
  { id: "all", label: "All" },
  { id: "solution_setup", label: "Agents" },
  { id: "ai_agent", label: "Voice" },
  { id: "automation", label: "SMS Automations" },
  { id: "campaign", label: "Campaigns" },
];

const STATUS_FILTERS: Array<{ id: "all" | SystemStatus; label: string }> = [
  { id: "all", label: "All statuses" },
  { id: "active", label: "Live" },
  { id: "draft", label: "Draft" },
  { id: "paused", label: "Paused" },
  { id: "needs_attention", label: "Needs Attention" },
];

function StatusPill({ status, label }: { status: SystemStatus; label: string }) {
  const liveLabel = status === "active" ? "Live" : label;
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
      {liveLabel}
    </span>
  );
}

function channelIcon(channels: string[]) {
  const joined = channels.join(" ").toLowerCase();
  if (joined.includes("voice") || joined.includes("ai")) return AudioLines;
  if (joined.includes("email")) return Megaphone;
  if (joined.includes("sms")) return MessageSquare;
  return Activity;
}

function AgentCard({ system }: { system: SystemResource }) {
  const Icon = channelIcon(system.channels);
  const caps = (system.capabilities || []).slice(0, 6);

  return (
    <article className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-[#111827]">
              {system.name}
            </h2>
            <p className="mt-0.5 text-[12px] font-medium text-[#6B7280]">
              {system.agentType}
            </p>
          </div>
        </div>
        <StatusPill status={system.status} label={system.statusLabel} />
      </div>

      {system.handles ? (
        <p className="mt-4 text-[12px] text-[#4B5563]">
          <span className="font-semibold text-[#111827]">Handles:</span>{" "}
          {system.handles}
        </p>
      ) : null}

      {caps.length ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Capabilities
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {caps.map((cap) => (
              <li
                key={cap}
                className="inline-flex items-center rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#374151]"
              >
                ✓ {cap}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <dt className="text-[#9CA3AF]">Channels</dt>
          <dd className="mt-0.5 font-medium text-[#111827]">
            {system.channels.join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-[#9CA3AF]">
            <Phone className="h-3 w-3" /> Phone
          </dt>
          <dd className="mt-0.5 font-medium text-[#111827]">
            {system.phoneNumber || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[#9CA3AF]">Primary workflow</dt>
          <dd className="mt-0.5 font-medium text-[#111827]">
            {system.primaryFlowName || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[#9CA3AF]">Telnyx / deploy</dt>
          <dd className="mt-0.5 font-medium text-[#111827]">
            {system.deploymentStatus || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[#9CA3AF]">Last activity</dt>
          <dd className="mt-0.5 font-medium text-[#111827]">
            {system.lastActivity || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[#9CA3AF]">Last execution</dt>
          <dd className="mt-0.5 font-medium text-[#111827]">
            {system.lastExecutionStatus || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[#9CA3AF]">Health</dt>
          <dd
            className={cn(
              "mt-0.5 font-medium",
              system.warning ? "text-rose-600" : "text-emerald-700",
            )}
          >
            {system.warning || "Healthy"}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#F3F4F6] pt-4">
        <Link
          href={system.href}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-[#111827] px-3 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
        >
          Manage
        </Link>
        {system.workflowHref ? (
          <Link
            href={system.workflowHref}
            className="inline-flex h-9 items-center justify-center rounded-md px-3 text-[12px] font-semibold text-[#2563EB] ring-1 ring-[#BFDBFE] hover:bg-[#EFF6FF]"
          >
            Open Workflow
          </Link>
        ) : null}
        {system.primaryFlowId ? (
          <Link
            href={`/automations/${system.primaryFlowId}?tab=executions`}
            className="inline-flex h-9 items-center justify-center rounded-md px-3 text-[12px] font-semibold text-[#4B5563] ring-1 ring-[#E5E7EB] hover:bg-slate-50"
          >
            Executions
          </Link>
        ) : null}
        {system.primaryFlowId ? (
          <Link
            href={`/automations/${system.primaryFlowId}/edit?diagnostics=1`}
            className="inline-flex h-9 items-center justify-center rounded-md px-3 text-[12px] font-semibold text-[#4B5563] ring-1 ring-[#E5E7EB] hover:bg-slate-50"
          >
            Test / Diagnostics
          </Link>
        ) : null}
        {system.children?.[0]?.href && !system.workflowHref ? (
          <Link
            href={system.children[0].href}
            className="inline-flex h-9 items-center justify-center rounded-md px-3 text-[12px] font-semibold text-[#2563EB] ring-1 ring-[#BFDBFE] hover:bg-[#EFF6FF]"
          >
            Details
          </Link>
        ) : null}
      </div>
    </article>
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
          My Agents
        </h1>
        <p className="mt-1.5 max-w-2xl text-[14px] text-[#6B7280]">
          Every agent you create — voice, SMS, and more. Wizards generate the
          agent and its workflow. Manage settings simply, or open Edit Workflow
          for the visual builder.
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-6 py-16 text-center">
          <p className="text-[14px] font-medium text-[#111827]">No agents yet</p>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Create one from AI Receptionist or SMS &amp; Messaging in the menu.
          </p>
          <Link
            href="/outcomes"
            className="mt-4 inline-flex h-9 items-center rounded-md bg-[#111827] px-4 text-[12px] font-semibold text-white"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((system) => (
            <AgentCard key={system.id} system={system} />
          ))}
        </div>
      )}
    </div>
  );
}
