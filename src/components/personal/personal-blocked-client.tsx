"use client";

import type { PersonalBlockedRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import {
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalPrimaryButton,
  PersonalSection,
  pMuted,
} from "./personal-ui";

export function PersonalBlockedClient() {
  const [rows, setRows] = useState<PersonalBlockedRow[]>([]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/personal/blocked");
    const j = await res.json().catch(() => ({}));
    setRows(j.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addNumber() {
    setMessage(null);
    const res = await fetch("/api/personal/blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(j.error || "Could not block number.");
      return;
    }
    setPhone("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/personal/blocked?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  return (
    <PersonalPageWrap>
      <PersonalPageHeader
        title="Blocked Numbers"
        description="Blocked callers are disconnected — no forward and no voicemail."
      />

      <PersonalSection title="Add number">
        <div className="flex flex-wrap gap-2">
          <input
            className="h-10 min-w-[200px] rounded-lg border border-[#e5e7eb] px-3 text-[14px]"
            placeholder="(703) 555-8812"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <PersonalPrimaryButton onClick={addNumber}>Block</PersonalPrimaryButton>
        </div>
        {message ? <p className="mt-2 text-[12px] text-rose-600">{message}</p> : null}
      </PersonalSection>

      <PersonalSection title="Blocked list">
        {loading ? (
          <p className={pMuted}>Loading…</p>
        ) : rows.length === 0 ? (
          <p className={pMuted}>No blocked numbers.</p>
        ) : (
          <ul className="divide-y divide-[#e5e7eb]">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 text-[14px]">
                <span className="font-medium">{formatPhone(r.phone)}</span>
                <button
                  type="button"
                  className="text-[12px] text-[#6366f1]"
                  onClick={() => remove(r.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </PersonalSection>
    </PersonalPageWrap>
  );
}
