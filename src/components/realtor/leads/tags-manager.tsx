"use client";

import { TAGS_DATA } from "@/lib/realtor/leads-crm-mock";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Check, Pencil, Plus, Search, Tag, Trash2, Users } from "lucide-react";
import { useState } from "react";

export function TagsManagerView() {
  const [selectedId, setSelectedId] = useState(TAGS_DATA[0]?.id || "");
  const selected = TAGS_DATA.find((t) => t.id === selectedId) || TAGS_DATA[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Tags</h1>
            <p className="mt-1 text-[15px] text-[#6b7280]">Manage tags to categorize and filter your leads.</p>
          </div>
          <button type="button" className="realtor-btn-primary">
            <Plus className="h-4 w-4" />
            New Tag
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="realtor-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-blue-50 text-blue-600">
                <Tag className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[12px] text-[#6b7280]">Total Tags</p>
                <p className="text-[28px] font-bold text-[#111827]">16</p>
                <p className="text-[12px] text-[#6b7280]">All time</p>
              </div>
            </div>
          </div>
          <div className="realtor-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[12px] text-[#6b7280]">Tagged Leads</p>
                <p className="text-[28px] font-bold text-[#111827]">2,487</p>
                <p className="text-[12px] text-[#6b7280]">Across all tags</p>
              </div>
            </div>
          </div>
        </div>

        <div className="realtor-card p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input placeholder="Search tags..." className="h-10 w-full rounded-lg border border-[#e5e7eb] pl-10 pr-3 text-[14px]" />
            </div>
            <select className="h-10 rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
              <option>All Tag Types</option>
            </select>
            <button type="button" className="realtor-btn-outline">
              <ArrowUpDown className="h-4 w-4" />
              Sort: A to Z
            </button>
          </div>
        </div>

        <div className="realtor-card overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
              <tr>
                <th className="px-4 py-3">Tag Name</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Leads</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {TAGS_DATA.map((tag) => (
                <tr
                  key={tag.id}
                  onClick={() => setSelectedId(tag.id)}
                  className={cn(
                    "cursor-pointer hover:bg-[#f9fafb]",
                    selectedId === tag.id && "bg-[#eff6ff]",
                  )}
                >
                  <td className="px-4 py-3 font-semibold text-[#111827]">{tag.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: tag.color }} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tag.typeClass)}>
                      {tag.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{tag.leads}</td>
                  <td className="px-4 py-3 text-[#6b7280]">{tag.description}</td>
                  <td className="px-4 py-3 text-[#6b7280]">{tag.created}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-[#e5e7eb] px-4 py-3 text-[12px] text-[#6b7280]">
            Showing 1 to 10 of 16 tags
          </div>
        </div>
      </div>

      {selected ? (
        <div className="realtor-card h-fit p-4">
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold text-[#111827]">{selected.name}</h3>
              </div>
              <button type="button" className="realtor-btn-outline h-8 px-2 text-[12px]">
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
          </div>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Type</dt>
              <dd>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", selected.typeClass)}>
                  {selected.type}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Color</dt>
              <dd className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: selected.color }} />
                {selected.color}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Leads</dt>
              <dd className="font-semibold">{selected.leads}</dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">Description</dt>
              <dd className="mt-1 text-[#374151]">{selected.description}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Created</dt>
              <dd>{selected.created} at 9:30 AM</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">Created By</dt>
              <dd className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e5e7eb] text-[10px] font-bold">SJ</span>
                Sarah Johnson
              </dd>
            </div>
          </dl>
          {selected.rules.length ? (
            <div className="mt-4">
              <h4 className="text-[13px] font-semibold text-[#111827]">Rules</h4>
              <ul className="mt-2 space-y-2 text-[13px] text-[#374151]">
                {selected.rules.map((rule) => (
                  <li key={rule} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button type="button" className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
            Delete Tag
          </button>
        </div>
      ) : null}
    </div>
  );
}
