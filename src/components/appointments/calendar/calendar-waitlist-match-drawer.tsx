"use client";

import { X } from "lucide-react";
import Link from "next/link";

export type WaitlistMatchRow = {
  entryId: string;
  contactLabel: string;
  preferenceSummary: string;
  staffPreferenceLabel?: string;
};

export type OpenSlotSummary = {
  startsAt: string;
  endsAt?: string;
  serviceName?: string;
  staffLabel?: string;
  locationLabel?: string;
};

type Props = {
  open: boolean;
  slot: OpenSlotSummary | null;
  matches: WaitlistMatchRow[];
  loading?: boolean;
  busyEntryId?: string | null;
  onClose: () => void;
  onOffer: (entryId: string) => void;
};

function fmtSlot(slot: OpenSlotSummary) {
  const start = new Date(slot.startsAt);
  const end = slot.endsAt ? new Date(slot.endsAt) : null;
  const day = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t1 = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const t2 = end?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return { day, range: `${t1}${t2 ? ` – ${t2}` : ""}` };
}

export function CalendarWaitlistMatchDrawer({
  open,
  slot,
  matches,
  loading,
  busyEntryId,
  onClose,
  onOffer,
}: Props) {
  if (!open || !slot) return null;
  const { day, range } = fmtSlot(slot);
  return (
    <div className="cal-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="cal-drawer cal-waitlist-match"
        role="dialog"
        aria-label="Waitlist matches"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cal-drawer-head">
          <div>
            <p className="cal-drawer-kicker">Open slot</p>
            <h2 className="cal-drawer-title">{day}</h2>
            <p className="cal-drawer-sub">{range}</p>
            {slot.serviceName ? <p className="text-xs">{slot.serviceName}</p> : null}
            <p className="text-[11px] text-[var(--muted)]">
              {[slot.locationLabel, slot.staffLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="cal-drawer-body text-xs">
          <p className="mb-2 font-medium">Matches</p>
          {loading ? <p className="text-[var(--muted)]">Loading matches…</p> : null}
          {!loading && !matches.length ? (
            <p className="text-[var(--muted)]">No waitlist clients match this opening.</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {matches.map((m) => (
              <li key={m.entryId} className="rounded border border-[var(--border)] p-2">
                <div className="font-medium">{m.contactLabel}</div>
                <div className="text-[var(--muted)]">{m.preferenceSummary}</div>
                {m.staffPreferenceLabel ? (
                  <div className="text-[11px] text-[var(--muted)]">{m.staffPreferenceLabel}</div>
                ) : null}
                <button
                  type="button"
                  className="appt-pilot-primary-btn mt-2 w-full"
                  disabled={busyEntryId === m.entryId}
                  onClick={() => onOffer(m.entryId)}
                >
                  {busyEntryId === m.entryId ? "Offering…" : "Offer slot"}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="cal-drawer-actions">
          <Link href="/appointments/waitlist" className="appt-pilot-secondary-btn w-full text-center">
            Open Waitlist
          </Link>
        </div>
      </aside>
    </div>
  );
}
