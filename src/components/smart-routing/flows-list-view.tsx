"use client";

import {
  SrOutlineButton,
  SrPageShell,
  SrPrimaryButton,
  SrStatusBadge,
  srCard,
} from "@/components/smart-routing/shared";
import {
  derivePrimaryDestination,
  FLOW_TYPE_LABELS,
  fmtPhoneDisplay,
  fmtRelativeTime,
} from "@/lib/smart-routing/display";
import {
  shouldUseWireframeOverview,
  WIREFRAME_DEMO_FLOWS,
  type WireframeFlowRow,
} from "@/lib/smart-routing/wireframe-demo";
import type { DraftConfig } from "@/lib/smart-routing/types";
import { cn } from "@/lib/utils";
import {
  Clock,
  Grid3x3,
  MessageSquare,
  MoreHorizontal,
  Network,
  Pencil,
  Plus,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type FlowRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  updatedAt: string;
  todayCalls?: number;
  assignedPhoneNumberId?: string | null;
  businessNumberE164?: string | null;
  draftConfigJson?: DraftConfig;
};

const FLOW_ICONS: Record<string, typeof Grid3x3> = {
  phone_menu: Grid3x3,
  missed_call_recovery: MessageSquare,
  after_hours: Clock,
  department: Users,
  custom: Network,
};

const STATUS_FILTERS = ["all", "active", "draft", "paused"] as const;

type TableRow = FlowRow | WireframeFlowRow;

function isDemoRow(row: TableRow): row is WireframeFlowRow {
  return "isDemo" in row && row.isDemo === true;
}

export function SmartRoutingFlowsListView({
  flows,
  numberMap,
  loading,
  onPause,
  onDuplicate,
}: {
  flows: FlowRow[];
  numberMap: Record<string, string>;
  loading: boolean;
  onPause: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const useWireframe = shouldUseWireframeOverview(flows.length, null);
  const tableRows: TableRow[] = useWireframe ? WIREFRAME_DEMO_FLOWS : flows;

  const filtered = useMemo(() => {
    return tableRows.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const number = isDemoRow(f)
        ? f.businessNumberE164
        : f.businessNumberE164 ?? numberMap[f.assignedPhoneNumberId ?? ""] ?? "";
      return (
        f.name.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q) ||
        number.includes(q)
      );
    });
  }, [tableRows, search, statusFilter, numberMap]);

  return (
    <SrPageShell
      title="Call Flows"
      description="Phone trees, call gates, and routing paths. Create a flow or open the builder to edit greetings, menus, and recovery rules."
      actions={
        <Link href="/smart-routing/new">
          <SrPrimaryButton>
            <Plus className="h-4 w-4" />
            Create Flow
          </SrPrimaryButton>
        </Link>
      }
    >
      <div className={cn(srCard, "overflow-hidden")}>
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-bold text-[#111827]">Your flows</h2>
              <p className="mt-1 text-[12px] text-[#6b7280]">
                Click a flow to open the builder. Test and activate from inside each flow.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-[#e5e7eb] p-0.5">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[12px] font-semibold capitalize",
                      statusFilter === f
                        ? "bg-[#6366f1] text-white"
                        : "text-[#6b7280] hover:text-[#111827]",
                    )}
                  >
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search flows…"
                  className="w-full rounded-lg border border-[#e5e7eb] py-2 pl-9 pr-3 text-[13px] focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/20"
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="p-10 text-center text-[13px] text-[#6b7280]">Loading flows…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-[13px]">
              <thead className="bg-[#f9fafb] text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
                <tr>
                  <th className="px-5 py-3">Flow Name</th>
                  <th className="px-3 py-3">Number</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Today&apos;s Calls</th>
                  <th className="px-3 py-3">Primary Destination</th>
                  <th className="px-3 py-3">Last Updated</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {filtered.map((f) => {
                  const Icon = FLOW_ICONS[f.type] ?? Grid3x3;
                  const demo = isDemoRow(f);
                  const number = demo
                    ? f.businessNumberE164
                    : f.businessNumberE164 ??
                      numberMap[(f as FlowRow).assignedPhoneNumberId ?? ""] ??
                      "—";
                  const destination = demo
                    ? f.primaryDestination
                    : derivePrimaryDestination(
                        (f as FlowRow).draftConfigJson,
                        f.type,
                      );
                  const updated = demo
                    ? f.updatedLabel
                    : fmtRelativeTime((f as FlowRow).updatedAt);
                  const href = demo ? "/smart-routing/new" : `/smart-routing/${f.id}`;

                  return (
                    <tr key={f.id} className="hover:bg-[#f9fafb]/80">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef2ff] text-[#6366f1]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <Link
                            href={href}
                            className="font-semibold text-[#111827] hover:text-[#6366f1]"
                          >
                            {f.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-[#374151]">{fmtPhoneDisplay(number)}</td>
                      <td className="px-3 py-4 text-[#374151]">
                        {FLOW_TYPE_LABELS[f.type] ?? f.type}
                      </td>
                      <td className="px-3 py-4">
                        <SrStatusBadge status={f.status} />
                      </td>
                      <td className="px-3 py-4 font-semibold text-[#111827]">
                        {demo ? f.todayCalls : (f as FlowRow).todayCalls ?? 0}
                      </td>
                      <td className="px-3 py-4 text-[#374151]">{destination}</td>
                      <td className="px-3 py-4 text-[#6b7280]">{updated}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={href}
                            className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#6366f1]"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          {!demo ? (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setMenuOpen(menuOpen === f.id ? null : f.id)
                                }
                                className="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6]"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {menuOpen === f.id ? (
                                <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                                  <Link
                                    href={`/smart-routing/${f.id}/test`}
                                    className="block px-3 py-2 text-[13px] hover:bg-[#f9fafb]"
                                    onClick={() => setMenuOpen(null)}
                                  >
                                    Test & Activate
                                  </Link>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#f9fafb]"
                                    onClick={async () => {
                                      await onPause(f.id);
                                      setMenuOpen(null);
                                    }}
                                  >
                                    Pause
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#f9fafb]"
                                    onClick={async () => {
                                      await onDuplicate(f.id);
                                      setMenuOpen(null);
                                    }}
                                  >
                                    Duplicate
                                  </button>
                                  <Link
                                    href={`/smart-routing/${f.id}/activity`}
                                    className="block px-3 py-2 text-[13px] hover:bg-[#f9fafb]"
                                    onClick={() => setMenuOpen(null)}
                                  >
                                    View Activity
                                  </Link>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#e5e7eb] px-5 py-3 text-[12px] text-[#6b7280]">
          Showing {filtered.length} flow{filtered.length === 1 ? "" : "s"}
          {useWireframe ? <span className="ml-2 text-[#9ca3af]">· Sample data shown</span> : null}
        </div>
      </div>
    </SrPageShell>
  );
}
