"use client";

import type { RealtorCallRow } from "@/lib/realtor/calls-crm-mock";
import { cn } from "@/lib/utils";
import { Bot, Download, MoreHorizontal, Phone, Play, User, Voicemail } from "lucide-react";
import Link from "next/link";

function dispositionClass(d: string): string {
  if (d === "New") return "bg-blue-50 text-blue-700";
  if (d === "Contacted") return "bg-emerald-50 text-emerald-700";
  return "bg-gray-100 text-gray-700";
}

export function CallTypeCell({ row }: { row: RealtorCallRow }) {
  if (row.isVoicemail) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-orange-700">
        <Voicemail className="h-3.5 w-3.5" />
        Voicemail
      </span>
    );
  }
  if (row.agentType === "ai") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-purple-700">
        <Bot className="h-3.5 w-3.5" />
        AI Call
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-700">
      <User className="h-3.5 w-3.5" />
      Human Call
    </span>
  );
}

export function CallsTableShell({
  rows,
  selected,
  onSelect,
  columns,
  footer,
  panel,
  renderCallType,
  showPlayColumn = false,
}: {
  rows: RealtorCallRow[];
  selected?: RealtorCallRow;
  onSelect: (row: RealtorCallRow) => void;
  columns: string[];
  footer: string;
  panel?: React.ReactNode;
  renderCallType?: (row: RealtorCallRow) => React.ReactNode;
  showPlayColumn?: boolean;
}) {
  return (
    <div className="flex gap-0 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
      <div className="min-w-0 flex-1">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-[13px]">
            <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
              <tr>
                {showPlayColumn ? <th className="w-10 px-4 py-3" /> : null}
                <th className="w-8 px-4 py-3"><input type="checkbox" aria-label="Select all" /></th>
                {columns.includes("date") ? <th className="px-4 py-3">Date &amp; Time</th> : null}
                {columns.includes("callType") ? <th className="px-4 py-3">Call Type</th> : null}
                {columns.includes("caller") ? <th className="px-4 py-3">Caller / Recipient</th> : null}
                {columns.includes("phone") ? <th className="px-4 py-3">Phone Number</th> : null}
                {columns.includes("agent") ? <th className="px-4 py-3">Agent</th> : null}
                {columns.includes("duration") ? <th className="px-4 py-3">Duration</th> : null}
                {columns.includes("outcome") ? <th className="px-4 py-3">Outcome</th> : null}
                {columns.includes("channel") ? <th className="px-4 py-3">Channel</th> : null}
                {columns.includes("disposition") ? <th className="px-4 py-3">Disposition</th> : null}
                {columns.includes("actions") ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row)}
                  className={cn("cursor-pointer hover:bg-[#f9fafb]", selected?.id === row.id && "bg-[#eff6ff]")}
                >
                  {showPlayColumn ? (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Play className="h-4 w-4 text-[#2563eb]" />
                    </td>
                  ) : null}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${row.callerName}`} />
                  </td>
                  {columns.includes("date") ? <td className="px-4 py-3 text-[#374151]">{row.dateTime}</td> : null}
                  {columns.includes("callType") ? (
                    <td className="px-4 py-3">
                      {renderCallType ? renderCallType(row) : <CallTypeCell row={row} />}
                    </td>
                  ) : null}
                  {columns.includes("caller") ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eff6ff] text-[10px] font-bold text-[#2563eb]">
                          {row.callerInitials}
                        </span>
                        <span>
                          <span className="font-semibold text-[#111827]">{row.callerName}</span>
                          {columns.includes("phone") ? null : (
                            <>
                              <br />
                              <span className="text-[12px] text-[#6b7280]">{row.callerPhone}</span>
                            </>
                          )}
                        </span>
                      </div>
                    </td>
                  ) : null}
                  {columns.includes("phone") ? <td className="px-4 py-3">{row.callerPhone}</td> : null}
                  {columns.includes("agent") ? (
                    <td className="px-4 py-3">
                      <div>{row.agent}</div>
                      <div className="text-[12px] text-[#6b7280]">{row.number}</div>
                    </td>
                  ) : null}
                  {columns.includes("duration") ? <td className="px-4 py-3 font-medium">{row.duration}</td> : null}
                  {columns.includes("outcome") ? (
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.outcomeClass)}>{row.outcome}</span>
                    </td>
                  ) : null}
                  {columns.includes("channel") ? (
                    <td className="px-4 py-3"><Phone className="h-4 w-4 text-[#6b7280]" /></td>
                  ) : null}
                  {columns.includes("disposition") ? (
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", dispositionClass(row.disposition))}>
                        {row.disposition}
                      </span>
                    </td>
                  ) : null}
                  {columns.includes("actions") ? (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 text-[#2563eb]">
                        <Play className="h-4 w-4" />
                        <Download className="h-4 w-4" />
                        <MoreHorizontal className="h-4 w-4 text-[#9ca3af]" />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-[12px] text-[#6b7280]">
          <span>{footer}</span>
          <div className="flex items-center gap-2">
            <select className="rounded border border-[#e5e7eb] px-2 py-1 text-[12px]"><option>20 per page</option></select>
            <div className="flex items-center gap-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] opacity-40">‹</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563eb] text-white">1</span>
              <Link href="#" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">2</Link>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb]">›</span>
            </div>
          </div>
        </div>
      </div>
      {panel}
    </div>
  );
}
