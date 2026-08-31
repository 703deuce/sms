"use client";

import React, { useMemo, useState } from "react";
import { Search, MoreVertical, Workflow, Users } from "lucide-react";
import Link from "next/link";
import type { KimiWorkflowRow } from "./types";

const subNav = [
  { label: "Flows", href: "/automations" },
  { label: "Templates", href: "/automations/templates" },
  { label: "Logs", href: "/automations/logs" },
];

export default function WorkflowsList({
  workflows,
  onCreate,
  onOpen,
}: {
  workflows: KimiWorkflowRow[];
  onCreate: () => void;
  onOpen: (flowId: string) => void;
}) {
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
      <div className="px-8 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
            <Workflow size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--navy)" }}>
              Automations
            </h1>
            <p className="text-[12.5px] text-muted-foreground">
              View and manage all of your automation workflows.
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-1 border-b border-border">
          {subNav.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`border-b-2 px-3 py-2 text-[13px] font-semibold transition ${
                tab.href === "/automations"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-9 w-64 rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="h-9 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            Create Workflow
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Status</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                    {workflows.length === 0
                      ? "No workflows yet. Create your first automation."
                      : "No workflows match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((wf) => (
                  <tr
                    key={wf.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onClick={() => onOpen(wf.id)}
                  >
                    <td className="px-5 py-4 align-top">
                      <p className="text-[13.5px] font-semibold text-foreground">{wf.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Last saved on {wf.lastSaved}
                      </p>
                    </td>
                    <td className="max-w-[280px] px-5 py-4 align-top">
                      <p className="text-[12.5px] text-foreground">{wf.description}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100">
                            <Users size={9} className="text-indigo-600" />
                          </span>
                          <b className="text-foreground">{wf.currentContacts}</b> Enrolled
                        </span>
                        <span>
                          <b className="text-foreground">{wf.clicks.toLocaleString()}</b> Messages
                        </span>
                        <span>
                          <b className="text-foreground">{wf.revenue}</b>
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-[11px] font-semibold ${
                          wf.status === "Active"
                            ? "bg-teal-100 text-teal-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {wf.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
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
          <select className="h-8 rounded-lg border border-border bg-card px-2 text-[12px] text-foreground outline-none">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
            <option>100 Per Page</option>
          </select>
        </div>
      </div>
    </div>
  );
}
