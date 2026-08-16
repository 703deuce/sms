"use client";

import type { PersonalActivityRow, PersonalBlockedRow, PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  PERSONAL_UNAVAILABLE_MESSAGE,
} from "@/lib/numbers/personal-call-settings";
import { formatPhone } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Ban,
  Clock,
  PhoneOff,
  Plus,
  Shield,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PersonalMockBarChart } from "./mockup/charts";
import {
  PersonalMockBtn,
  PersonalMockFilterChips,
  PersonalMockHeader,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPagination,
  PersonalMockPill,
  PersonalMockSection,
  pm,
} from "./mockup/primitives";
import { PersonalNumberSelector } from "./personal-number-selector";

type ScopeSegment = "all" | "account" | "number";
type ReasonFilter = "All" | "Manual" | "Spam" | "Fraud";

type BlockedDisplayRow = PersonalBlockedRow & {
  scopeLabel: string;
  scopeKind: "account" | "number";
  numberId?: string;
};

function trendPct(current: number, previous: number): number | undefined {
  if (previous === 0) return current > 0 ? 100 : undefined;
  return Math.round(((current - previous) / previous) * 100);
}

function reasonLabel(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("spam")) return "Spam";
  if (r.includes("fraud")) return "Fraud";
  if (r.includes("blocked")) return "Blocked";
  return reason.replace(/_/g, " ");
}

function behaviorLabel(action: "disconnect" | "unavailable_message"): string {
  return action === "unavailable_message" ? "Unavailable message" : "Disconnect";
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isLastMonth(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getMonth() === last.getMonth() && d.getFullYear() === last.getFullYear();
}

export function PersonalBlockedClient({
  numbers,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const [rows, setRows] = useState<BlockedDisplayRow[]>([]);
  const [activity, setActivity] = useState<PersonalActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scopeSegment, setScopeSegment] = useState<ScopeSegment>("all");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("All");
  const [addOpen, setAddOpen] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [manageRow, setManageRow] = useState<BlockedDisplayRow | null>(null);
  const [blockedAction, setBlockedAction] = useState<"disconnect" | "unavailable_message">(
    "disconnect",
  );
  const [unavailableDraft, setUnavailableDraft] = useState(PERSONAL_UNAVAILABLE_MESSAGE);
  const [savingAction, setSavingAction] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  const selectedId =
    searchParams.get("numberId") || initialNumberId || numbers[0]?.id || "";

  const selected = numbers.find((n) => n.id === selectedId);

  const loadActivity = useCallback(async () => {
    const res = await fetch("/api/personal/activity?limit=200");
    const j = await res.json().catch(() => ({}));
    setActivity(j.data || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (scopeSegment === "number") {
        if (!selectedId) {
          setRows([]);
          setLoading(false);
          return;
        }
        const res = await fetch(
          `/api/personal/blocked?numberId=${encodeURIComponent(selectedId)}`,
        );
        const j = await res.json().catch(() => ({}));
        const selectedNumber = numbers.find((n) => n.id === selectedId);
        setRows(
          (j.data || []).map((r: PersonalBlockedRow) => ({
            ...r,
            scopeLabel: selectedNumber ? formatPhone(selectedNumber.number) : "This number",
            scopeKind: "number" as const,
            numberId: selectedId,
          })),
        );
      } else {
        const merged: BlockedDisplayRow[] = [];
        const seen = new Set<string>();

        const accRes = await fetch("/api/personal/blocked");
        const accJson = await accRes.json().catch(() => ({}));
        for (const r of accJson.data || []) {
          merged.push({
            ...r,
            scopeLabel: "Account-wide",
            scopeKind: "account",
          });
          seen.add(r.id);
        }

        for (const n of numbers) {
          const res = await fetch(
            `/api/personal/blocked?numberId=${encodeURIComponent(n.id)}`,
          );
          const j = await res.json().catch(() => ({}));
          for (const r of j.data || []) {
            if (!seen.has(r.id)) {
              merged.push({
                ...r,
                scopeLabel: formatPhone(n.number),
                scopeKind: "number",
                numberId: n.id,
              });
              seen.add(r.id);
            }
          }
        }

        setRows(merged);
      }
    } finally {
      setLoading(false);
    }
  }, [scopeSegment, selectedId, numbers]);

  useEffect(() => {
    load();
    loadActivity();
  }, [load, loadActivity]);

  useEffect(() => {
    if (!selected) return;
    const settings =
      selected.settingsJson && typeof selected.settingsJson === "object"
        ? (selected.settingsJson as Record<string, unknown>)
        : {};
    setBlockedAction(
      settings.blockedCallerAction === "unavailable_message"
        ? "unavailable_message"
        : "disconnect",
    );
  }, [selected]);

  useEffect(() => {
    if (!manageRow) return;
    const numberForRow = manageRow.numberId
      ? numbers.find((n) => n.id === manageRow.numberId)
      : selected;
    if (!numberForRow) return;
    const settings =
      numberForRow.settingsJson && typeof numberForRow.settingsJson === "object"
        ? (numberForRow.settingsJson as Record<string, unknown>)
        : {};
    setBlockedAction(
      settings.blockedCallerAction === "unavailable_message"
        ? "unavailable_message"
        : "disconnect",
    );
    setUnavailableDraft(PERSONAL_UNAVAILABLE_MESSAGE);
  }, [manageRow, numbers, selected]);

  const activityByCaller = useMemo(() => {
    const counts = new Map<string, number>();
    const lastAttempt = new Map<string, string>();
    for (const row of activity) {
      if (!row.blocked) continue;
      const key = row.caller.replace(/\D/g, "");
      counts.set(key, (counts.get(key) || 0) + 1);
      const stamp = `${row.date} ${row.time}`;
      if (!lastAttempt.has(key) || stamp > lastAttempt.get(key)!) {
        lastAttempt.set(key, stamp);
      }
    }
    return { counts, lastAttempt };
  }, [activity]);

  const scopedRows = useMemo(() => {
    let list = rows;
    if (scopeSegment === "account") {
      list = list.filter((r) => r.scopeKind === "account");
    }
    if (reasonFilter !== "All") {
      list = list.filter((r) => {
        const reason = r.reason.toLowerCase();
        if (reasonFilter === "Manual") {
          return reason.includes("blocked") || reason.includes("user");
        }
        return reason.includes(reasonFilter.toLowerCase());
      });
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.phone.includes(q) ||
        formatPhone(r.phone).toLowerCase().includes(q) ||
        r.scopeLabel.toLowerCase().includes(q) ||
        reasonLabel(r.reason).toLowerCase().includes(q),
    );
  }, [rows, scopeSegment, reasonFilter, search]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const thisMonth = rows.filter((r) => isThisMonth(r.createdAt)).length;
    const lastMonth = rows.filter((r) => isLastMonth(r.createdAt)).length;
    const callsBlocked = activity.filter((r) => r.blocked).length;
    const midpoint = Math.floor(activity.length / 2);
    const firstHalfBlocked = activity.slice(midpoint).filter((r) => r.blocked).length;
    const secondHalfBlocked = activity.slice(0, midpoint).filter((r) => r.blocked).length;
    const numbersWithBlocks = new Set(
      rows.filter((r) => r.scopeKind === "number" && r.numberId).map((r) => r.numberId),
    ).size;

    return {
      total,
      thisMonth,
      thisMonthTrend: trendPct(thisMonth, lastMonth),
      callsBlocked,
      callsTrend: trendPct(secondHalfBlocked, firstHalfBlocked),
      numbersProtected: numbersWithBlocks || (rows.length > 0 ? numbers.length : 0),
    };
  }, [rows, activity, numbers.length]);

  const protectionSummary = useMemo(() => {
    const withBlocks = numbers
      .map((n) => ({
        label: formatPhone(n.number),
        value: rows.filter((r) => r.numberId === n.id).length,
      }))
      .filter((x) => x.value > 0)
      .slice(0, 5);
    if (withBlocks.length === 0 && rows.some((r) => r.scopeKind === "account")) {
      return [{ label: "Account-wide blocks", value: rows.filter((r) => r.scopeKind === "account").length }];
    }
    return withBlocks;
  }, [numbers, rows]);

  const recentActivity = useMemo(() => {
    return activity
      .filter((r) => r.blocked)
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        text: `Blocked call from ${formatPhone(r.caller)}`,
        at: `${r.date} ${r.time}`,
      }));
  }, [activity]);

  async function addNumber() {
    const targetId = scopeSegment === "number" ? selectedId : undefined;
    if (scopeSegment === "number" && !targetId) {
      setMessage("Select a number first.");
      return;
    }
    setMessage(null);
    const res = await fetch("/api/personal/blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: addPhone,
        numberId: targetId || undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(j.error || "Could not block number.");
      return;
    }
    setAddPhone("");
    setAddOpen(false);
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/personal/blocked?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (manageRow?.id === id) setManageRow(null);
    load();
  }

  async function saveBlockedAction() {
    const numberId = manageRow?.numberId || selectedId;
    if (!numberId) return;
    setSavingAction(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/numbers/${numberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalCallSettings: { blockedCallerAction: blockedAction },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error || "Could not save blocked-caller behavior.");
      }
      setMessage("Blocked-caller behavior saved.");
      setManageRow(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save blocked-caller behavior.");
    } finally {
      setSavingAction(false);
    }
  }

  async function importBlockList(file: File) {
    const text = await file.text();
    const phones = text
      .split(/[\n,;]+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (phones.length === 0) {
      setMessage("No phone numbers found in file.");
      return;
    }
    setMessage(null);
    let ok = 0;
    for (const phone of phones) {
      const res = await fetch("/api/personal/blocked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          numberId: scopeSegment === "number" ? selectedId : undefined,
        }),
      });
      if (res.ok) ok += 1;
    }
    setMessage(`Imported ${ok} of ${phones.length} numbers to the block list.`);
    load();
  }

  const behaviorForRow = (row: BlockedDisplayRow) => {
    const n = row.numberId ? numbers.find((x) => x.id === row.numberId) : selected;
    if (!n) return behaviorLabel(blockedAction);
    const settings =
      n.settingsJson && typeof n.settingsJson === "object"
        ? (n.settingsJson as Record<string, unknown>)
        : {};
    const action =
      settings.blockedCallerAction === "unavailable_message"
        ? "unavailable_message"
        : "disconnect";
    return behaviorLabel(action);
  };

  if (numbers.length === 0) {
    return (
      <PersonalMockPage>
        <PersonalMockHeader
          title="Blocked Callers"
          description="Control which callers can reach your Transovo numbers."
        />
        <p className={pm.muted}>Add a number before managing blocked callers.</p>
      </PersonalMockPage>
    );
  }

  return (
    <div className="relative">
      <PersonalMockPage>
        <PersonalMockHeader
          title="Blocked Callers"
          description="Control which callers can reach your numbers — block spam, fraud, or unwanted contacts account-wide or per line."
          actions={
            <>
              <PersonalMockBtn onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Block a Number
              </PersonalMockBtn>
              <PersonalMockBtn
                variant="outline"
                onClick={() => importRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Import Block List
              </PersonalMockBtn>
              <input
                ref={importRef}
                type="file"
                accept=".txt,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importBlockList(file);
                  e.target.value = "";
                }}
              />
              <div className="relative">
                <PersonalMockInput
                  className="w-56 bg-[#f9fafb] focus:bg-white"
                  placeholder="Search blocked numbers…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </>
          }
          filters={
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-lg border border-[#e5e7eb] bg-white p-0.5">
                {(
                  [
                    { id: "all", label: "All Blocks" },
                    { id: "account", label: "Account-Wide" },
                    { id: "number", label: "This Number" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setScopeSegment(tab.id)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[12px] font-semibold transition",
                      scopeSegment === tab.id
                        ? "bg-[#6366f1] text-white"
                        : "text-[#6b7280] hover:bg-[#f9fafb]",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {scopeSegment === "number" ? (
                <PersonalNumberSelector numbers={numbers} selectedId={selectedId} label="" />
              ) : null}
              <PersonalMockFilterChips
                options={["All", "Manual", "Spam", "Fraud"]}
                active={reasonFilter}
                onChange={(v) => setReasonFilter(v as ReasonFilter)}
              />
            </div>
          }
        />

        {message ? <p className="text-[13px] text-[#6b7280]">{message}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PersonalMockKpi label="Total Blocked" value={kpis.total} icon={Ban} />
          <PersonalMockKpi
            label="Blocked This Month"
            value={kpis.thisMonth}
            icon={Clock}
            trend={kpis.thisMonthTrend}
            trendLabel="vs last month"
          />
          <PersonalMockKpi
            label="Calls Blocked"
            value={kpis.callsBlocked}
            icon={PhoneOff}
            iconClass="bg-[#fef2f2] text-[#dc2626]"
            trend={kpis.callsTrend}
            trendLabel="vs prior period"
          />
          <PersonalMockKpi
            label="Numbers Protected"
            value={kpis.numbersProtected}
            sub={`of ${numbers.length} lines`}
            icon={Shield}
            iconClass="bg-[#eef2ff] text-[#6366f1]"
          />
        </div>

        <PersonalMockSection title="Blocked Callers">
          {loading ? (
            <p className={pm.muted}>Loading…</p>
          ) : scopedRows.length === 0 ? (
            <p className={pm.muted}>
              {scopeSegment === "number" && selected
                ? `No blocked numbers for ${formatPhone(selected.number)}.`
                : "No blocked numbers yet."}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[880px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    <th className="pb-3 pr-3">Phone Number</th>
                    <th className="pb-3 pr-3">Label</th>
                    <th className="pb-3 pr-3">Scope</th>
                    <th className="pb-3 pr-3">Behavior</th>
                    <th className="pb-3 pr-3">Blocked Calls</th>
                    <th className="pb-3 pr-3">Last Attempt</th>
                    <th className="pb-3 pr-3">Added</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {scopedRows.map((r) => {
                    const phoneKey = r.phone.replace(/\D/g, "");
                    const blockedCalls = activityByCaller.counts.get(phoneKey) || 0;
                    const lastAttempt = activityByCaller.lastAttempt.get(phoneKey) || "—";
                    return (
                      <tr key={r.id}>
                        <td className="py-3 pr-3 font-semibold text-[#111827]">
                          {formatPhone(r.phone)}
                        </td>
                        <td className="py-3 pr-3">
                          <PersonalMockPill tone="gray">{reasonLabel(r.reason)}</PersonalMockPill>
                        </td>
                        <td className="py-3 pr-3 text-[#6b7280]">{r.scopeLabel}</td>
                        <td className="py-3 pr-3 text-[#6b7280]">{behaviorForRow(r)}</td>
                        <td className="py-3 pr-3 font-medium">{blockedCalls}</td>
                        <td className="py-3 pr-3 text-[#6b7280]">{lastAttempt}</td>
                        <td className="py-3 pr-3 text-[#6b7280]">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          <PersonalMockBtn
                            variant="outline"
                            className="h-8 px-3 text-[12px]"
                            onClick={() => setManageRow(r)}
                          >
                            Manage
                          </PersonalMockBtn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <PersonalMockPagination
                showing={`Showing ${scopedRows.length} blocked caller${scopedRows.length === 1 ? "" : "s"}`}
                total={scopedRows.length}
              />
            </div>
          )}
        </PersonalMockSection>

        <div className="grid gap-4 lg:grid-cols-2">
          <PersonalMockSection title="Recent Blocked Activity">
            {recentActivity.length === 0 ? (
              <p className={pm.muted}>No blocked calls recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-[13px]">
                    <Ban className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" />
                    <div>
                      <p className="text-[#111827]">{a.text}</p>
                      <p className="text-[11px] text-[#9ca3af]">{a.at}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PersonalMockSection>

          <PersonalMockSection title="Call Protection Summary">
            {protectionSummary.length === 0 ? (
              <p className={pm.muted}>No numbers have blocked callers yet.</p>
            ) : (
              <PersonalMockBarChart items={protectionSummary} maxLabel="Blocks per number" />
            )}
          </PersonalMockSection>
        </div>
      </PersonalMockPage>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className={cn(pm.card, "w-full max-w-md p-5")}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-[#111827]">Block a Number</h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg p-1 hover:bg-[#f3f4f6]"
              >
                <X className="h-5 w-5 text-[#6b7280]" />
              </button>
            </div>
            <p className="mt-2 text-[13px] text-[#6b7280]">
              {scopeSegment === "number" && selected
                ? `Blocked callers cannot reach ${formatPhone(selected.number)}.`
                : "Block callers account-wide across your Transovo numbers."}
            </p>
            <PersonalMockInput
              className="mt-4"
              placeholder="(703) 555-8812"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <PersonalMockBtn className="flex-1" onClick={addNumber} disabled={!addPhone.trim()}>
                Block number
              </PersonalMockBtn>
              <PersonalMockBtn variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </PersonalMockBtn>
            </div>
          </div>
        </div>
      ) : null}

      {manageRow ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close blocked caller details"
            onClick={() => setManageRow(null)}
          />
          <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
              <h2 className="text-[16px] font-bold text-[#111827]">Manage Blocked Caller</h2>
              <button
                type="button"
                onClick={() => setManageRow(null)}
                className="rounded-lg p-1 hover:bg-[#f3f4f6]"
              >
                <X className="h-5 w-5 text-[#6b7280]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  Blocked number
                </p>
                <p className="mt-1 text-[20px] font-bold text-[#111827]">
                  {formatPhone(manageRow.phone)}
                </p>
                <p className="mt-1 text-[13px] text-[#6b7280]">
                  Scope: {manageRow.scopeLabel} · Added{" "}
                  {new Date(manageRow.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div>
                <p className="mb-3 text-[13px] font-semibold text-[#111827]">
                  Call handling for blocked callers
                </p>
                <p className="mb-3 text-[12px] text-[#6b7280]">
                  Applies to the Transovo line this block is tied to.
                </p>
                <div className="space-y-2 text-[13px]">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={blockedAction === "disconnect"}
                      onChange={() => setBlockedAction("disconnect")}
                    />
                    Disconnect immediately
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={blockedAction === "unavailable_message"}
                      onChange={() => setBlockedAction("unavailable_message")}
                    />
                    Play unavailable message, then disconnect
                  </label>
                </div>
              </div>

              {blockedAction === "unavailable_message" ? (
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-[#111827]">
                    Unavailable message
                  </p>
                  <textarea
                    className="w-full rounded-lg border border-[#e5e7eb] p-3 text-[13px] outline-none focus:border-[#6366f1] bg-[#f9fafb]"
                    rows={3}
                    value={unavailableDraft}
                    readOnly
                    aria-readonly
                  />
                  <p className="mt-1 text-[11px] text-[#9ca3af]">
                    System message played to blocked callers on this line.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="border-t border-[#e5e7eb] p-5 space-y-2">
              <PersonalMockBtn
                className="w-full"
                disabled={savingAction}
                onClick={saveBlockedAction}
              >
                {savingAction ? "Saving…" : "Save behavior"}
              </PersonalMockBtn>
              <PersonalMockBtn
                variant="outline"
                className="w-full text-rose-600 hover:bg-[#fef2f2]"
                onClick={() => remove(manageRow.id)}
              >
                Unblock caller
              </PersonalMockBtn>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
