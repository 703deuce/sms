"use client";

import type { PersonalActivityRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PersonalNumberSelector } from "./personal-number-selector";
import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalSection,
  pMuted,
} from "./personal-ui";

export function PersonalActivityClient({
  numbers,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const [rows, setRows] = useState<PersonalActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "answered" | "missed" | "voicemail">("all");
  const [search, setSearch] = useState("");
  const numberId = initialNumberId || numbers[0]?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (numberId) params.set("numberId", numberId);
    const res = await fetch(`/api/personal/activity?${params}`);
    const j = await res.json().catch(() => ({}));
    setRows(j.data || []);
    setLoading(false);
  }, [numberId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (filter === "answered" && !r.answered) return false;
    if (filter === "missed" && r.answered) return false;
    if (filter === "voicemail" && !r.voicemail) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.caller.includes(q) ||
      r.calledNumber.includes(q) ||
      (r.forwardDestination?.toLowerCase().includes(q) ?? false)
    );
  });

  async function blockCaller(phone: string) {
    await fetch("/api/personal/blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    load();
  }

  return (
    <PersonalPageWrap>
      <PersonalPageHeader
        title="Call Activity"
        description="Inbound calls across your Transovo numbers — answered, missed, voicemail, and forwarding outcomes."
      />
      <PersonalNumberSelector numbers={numbers} selectedId={numberId} allowAll />

      <div className="flex flex-wrap gap-2">
        {(["all", "answered", "missed", "voicemail"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-[13px] ${
              filter === f ? "bg-[#6366f1] text-white" : "bg-[#f3f4f6] text-[#374151]"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <input
        className="h-10 w-full max-w-md rounded-lg border border-[#e5e7eb] px-3 text-[14px]"
        placeholder="Search caller, number, or destination"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <PersonalSection title="Recent calls">
        {loading ? (
          <p className={pMuted}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className={pMuted}>No call activity yet.</p>
        ) : (
          <ul className="divide-y divide-[#e5e7eb]">
            {filtered.map((r) => (
              <li key={r.id} className="py-4 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[14px]">{formatPhone(r.caller)}</span>
                  <span className="text-[12px] text-[#6b7280]">{r.date} {r.time}</span>
                </div>
                <p className="text-[13px] text-[#6b7280]">
                  → {formatPhone(r.calledNumber)}
                  {r.forwardDestination ? ` · Forwarded to ${r.forwardDestination}` : ""}
                </p>
                <p className="text-[13px]">
                  <span className="font-medium">{r.outcome}</span>
                  {r.durationSeconds > 0 ? ` · ${formatDuration(r.durationSeconds)}` : ""}
                  {r.blocked ? " · Blocked" : ""}
                </p>
                {!r.blocked ? (
                  <button
                    type="button"
                    className="text-[12px] text-[#6366f1]"
                    onClick={() => blockCaller(r.caller)}
                  >
                    Block caller
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PersonalSection>

      <p className={pMuted}>
        <Link href="/personal/blocked" className="text-[#6366f1]">Manage blocked numbers</Link>
      </p>
    </PersonalPageWrap>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
