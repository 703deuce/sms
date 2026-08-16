"use client";

import type { PhoneNumber } from "@/lib/types";
import { formatPhone } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalPrimaryButton,
  PersonalSection,
  PersonalStatusBadge,
  pMuted,
} from "./personal-ui";

export function PersonalForwardingUI({
  numbers,
  initialNumberId,
}: {
  numbers: PhoneNumber[];
  initialNumberId?: string;
}) {
  const router = useRouter();
  const [editId, setEditId] = useState(initialNumberId || numbers[0]?.id || "");
  const [destination, setDestination] = useState("");
  const [forwardingOn, setForwardingOn] = useState(false);
  const [ringSeconds, setRingSeconds] = useState(25);
  const [unansweredAction, setUnansweredAction] = useState<"voicemail" | "end">("voicemail");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = numbers.find((n) => n.id === editId);

  useEffect(() => {
    if (!selected) return;
    setDestination(selected.voiceForwardTo || "");
    setForwardingOn(Boolean(selected.voiceForwardTo));
    const settings =
      selected.settingsJson && typeof selected.settingsJson === "object"
        ? (selected.settingsJson as Record<string, unknown>)
        : {};
    const ring = settings.forwardRingSeconds;
    setRingSeconds(typeof ring === "number" ? ring : 25);
    setUnansweredAction(settings.forwardUnansweredAction === "end" ? "end" : "voicemail");
  }, [selected]);

  const activity = numbers
    .filter((n) => n.voiceForwardTo)
    .slice(0, 3)
    .map((n) => ({
      id: n.id,
      from: formatPhone(n.number),
      to: formatPhone(n.voiceForwardTo!),
    }));

  async function save() {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/numbers/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalCallSettings: {
            forwardingEnabled: forwardingOn,
            forwardDestination: forwardingOn ? destination : null,
            forwardRingSeconds: ringSeconds,
            forwardUnansweredAction: unansweredAction,
            voicemailEnabled: unansweredAction === "voicemail",
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Could not save forwarding.");
      }
      setMessage("Forwarding saved.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save forwarding.");
    } finally {
      setSaving(false);
    }
  }

  if (numbers.length === 0) {
    return (
      <PersonalPageWrap>
        <p className={pMuted}>
          No numbers yet.{" "}
          <Link href="/personal/numbers/premium" className="text-[#6366f1]">Find a number</Link>
        </p>
      </PersonalPageWrap>
    );
  }

  return (
    <PersonalPageWrap>
      <PersonalPageHeader
        title="Call Forwarding"
        description="Ring your phone first. If you don't answer, Transovo can take the voicemail — not your carrier."
      />

      <PersonalSection title="Your forwarding setup">
        <div className="space-y-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
              Your number
            </p>
            <select
              className="mt-1 h-10 w-full max-w-md rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px] font-semibold"
              value={editId}
              onChange={(e) => setEditId(e.target.value)}
            >
              {numbers.map((n) => (
                <option key={n.id} value={n.id}>{formatPhone(n.number)}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
              Forward calls to
            </p>
            <input
              className="mt-1 h-10 w-full max-w-md rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px]"
              placeholder="(571) 477-6175"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={!forwardingOn}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-[#374151]">Forwarding</span>
            <button
              type="button"
              onClick={() => setForwardingOn((v) => !v)}
              className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                forwardingOn
                  ? "bg-[#ecfdf5] text-[#059669]"
                  : "bg-[#f3f4f6] text-[#6b7280]"
              }`}
            >
              {forwardingOn ? "ON" : "OFF"}
            </button>
            <PersonalStatusBadge status={forwardingOn ? "active" : "inactive"} />
          </div>

          {forwardingOn ? (
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 space-y-3">
              <p className="text-[13px] font-semibold text-[#111827]">If unanswered</p>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <span>After</span>
                <input
                  type="number"
                  min={10}
                  max={60}
                  className="h-9 w-16 rounded-lg border border-[#e5e7eb] bg-white px-2 text-center"
                  value={ringSeconds}
                  onChange={(e) => setRingSeconds(Number(e.target.value) || 25)}
                />
                <span>seconds</span>
              </div>
              <div className="space-y-2 text-[13px]">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="unanswered"
                    checked={unansweredAction === "voicemail"}
                    onChange={() => setUnansweredAction("voicemail")}
                  />
                  Send to Transovo Voicemail
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="unanswered"
                    checked={unansweredAction === "end"}
                    onChange={() => setUnansweredAction("end")}
                  />
                  End the call
                </label>
              </div>
            </div>
          ) : null}

          <PersonalPrimaryButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </PersonalPrimaryButton>
          {message ? <p className="text-[12px] text-[#6b7280]">{message}</p> : null}
        </div>
      </PersonalSection>

      <PersonalSection title="Recent forwarding activity">
        {activity.length === 0 ? (
          <p className={pMuted}>No forwarding activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-[13px]">
                <span className="font-medium">{a.from}</span>
                <ArrowRight className="h-3 w-3 text-[#9ca3af]" />
                <span className="text-[#6b7280]">{a.to}</span>
              </li>
            ))}
          </ul>
        )}
      </PersonalSection>
    </PersonalPageWrap>
  );
}
