"use client";

import type { PersonalBlockedRow, PersonalNumberRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PersonalNumberSelector } from "./personal-number-selector";
import {
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalPrimaryButton,
  PersonalSection,
  pMuted,
} from "./personal-ui";

export function PersonalBlockedClient({
  numbers,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const [rows, setRows] = useState<PersonalBlockedRow[]>([]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const selectedId =
    searchParams.get("numberId") || initialNumberId || numbers[0]?.id || "";
  const [blockedAction, setBlockedAction] = useState<"disconnect" | "unavailable_message">(
    "disconnect",
  );
  const [savingAction, setSavingAction] = useState(false);

  const selected = numbers.find((n) => n.id === selectedId);

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

  useEffect(() => {
    if (!selected) return;
    const settings =
      selected.settingsJson && typeof selected.settingsJson === "object"
        ? (selected.settingsJson as Record<string, unknown>)
        : {};
    setBlockedAction(
      settings.blockedCallerAction === "unavailable_message" ? "unavailable_message" : "disconnect",
    );
  }, [selected]);

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

  async function saveBlockedAction() {
    if (!selectedId) return;
    setSavingAction(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/numbers/${selectedId}`, {
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
      setMessage("Blocked-caller behavior saved for this number.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save blocked-caller behavior.");
    } finally {
      setSavingAction(false);
    }
  }

  const actionDescription =
    blockedAction === "unavailable_message"
      ? "Blocked callers hear a short unavailable message, then the call ends."
      : "Blocked callers are disconnected immediately — no forward and no voicemail.";

  return (
    <PersonalPageWrap>
      <PersonalPageHeader
        title="Blocked Numbers"
        description="Workspace-wide block list. Choose how blocked callers are handled per number."
      />

      {numbers.length > 0 ? (
        <PersonalSection title="When a blocked caller reaches this number">
          <PersonalNumberSelector numbers={numbers} selectedId={selectedId} />
          <p className="mt-3 text-[13px] text-[#374151]">{actionDescription}</p>
          <div className="mt-3 space-y-2 text-[13px]">
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
          <PersonalPrimaryButton
            className="mt-3"
            onClick={saveBlockedAction}
            disabled={savingAction || !selectedId}
          >
            {savingAction ? "Saving…" : "Save behavior"}
          </PersonalPrimaryButton>
        </PersonalSection>
      ) : null}

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

      {message ? <p className="text-[12px] text-[#6b7280]">{message}</p> : null}
    </PersonalPageWrap>
  );
}
