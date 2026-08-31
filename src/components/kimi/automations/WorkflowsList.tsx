"use client";

import React, { useMemo, useState } from "react";
import { Search, MoreVertical, Workflow, Users, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTOMATION_NAV_TABS } from "@/lib/automations/nav-tabs";
import type { KimiWorkflowRow } from "./types";

export default function WorkflowsList({
  workflows,
  onCreate,
  onOpen,
}: {
  workflows: KimiWorkflowRow[];
  onCreate: () => void;
  onOpen: (flowId: string) => void;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter(
      (wf) =>
        wf.name.toLowerCase().includes(q) ||
        wf.description.toLowerCase().includes(q),
    );
  }, [workflows, query]);

  return (
    <div className="kimi-automations flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-[1100px] px-8 pb-10 pt-6">
        {/* Page heading */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 shadow-inner">
            <Workflow size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-[21px] font-bold leading-tight" style={{ color: "var(--navy, #1e2a5a)" }}>
              Automations
            </h1>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              View and manage all of your automation workflows.
            </p>
          </div>
        </div>

        {/* Sub nav */}
        <div className="mt-5 flex gap-1 border-b border-border">
          {AUTOMATION_NAV_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`palette-tab px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                pathname === tab.href
                  ? "active text-indigo-700"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[12px] font-medium text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "workflow" : "workflows"}
          </p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="h-9 w-64 rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 active:bg-indigo-800"
            >
              <Plus size={14} strokeWidth={2.5} />
              Create Workflow
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flows-table mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Status</th>
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center">
                    <div className="mx-auto flex max-w-xs flex-col items-center gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50">
                        <Workflow size={18} className="text-indigo-500" />
                      </div>
                      <p className="text-[13.5px] font-semibold text-foreground">
                        {workflows.length === 0 ? "No workflows yet" : "No matches"}
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        {workflows.length === 0
                          ? "Create your first automation to start enrolling contacts."
                          : "Try a different search term."}
                      </p>
                      {workflows.length === 0 && (
                        <button
                          type="button"
                          onClick={onCreate}
                          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-[12px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                        >
                          <Plus size={13} strokeWidth={2.5} /> Create Workflow
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((wf) => (
                  <tr
                    key={wf.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-indigo-50/40"
                    onClick={() => onOpen(wf.id)}
                  >
                    <td className="px-5 py-4 align-top">
                      <p className="text-[13.5px] font-semibold leading-snug text-foreground">
                        {wf.name}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Last saved on {wf.lastSaved}
                      </p>
                    </td>
                    <td className="max-w-[320px] px-5 py-4 align-top">
                      <p className="truncate text-[12.5px] text-foreground/90">{wf.description}</p>
                      <div className="mt-2.5 flex items-start gap-5">
                        <span className="flow-stat">
                          <b className="inline-flex items-center gap-1">
                            <Users size={11} className="text-indigo-500" />
                            {wf.currentContacts}
                          </b>
                          <span>Enrolled</span>
                        </span>
                        <span className="flow-stat">
                          <b>{wf.clicks.toLocaleString()}</b>
                          <span>Messages</span>
                        </span>
                        <span className="flow-stat">
                          <b>{wf.revenue}</b>
                          <span>Result</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      <span
                        className={`status-pill ${
                          wf.status === "Active" ? "active" : "inactive"
                        }`}
                      >
                        {wf.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Actions for ${wf.name}`}
                      >
                        <MoreVertical size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="py-4">
          <select className="h-8 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground shadow-sm outline-none transition focus:border-indigo-400">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
            <option>100 Per Page</option>
          </select>
        </div>
      </div>
    </div>
  );
}
