"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatTime12h } from "@/lib/appointments/availability/availability-workspace";

type Slot = { startsAt: string; endsAt?: string; staffId?: string };

type Props = {
  services: Array<{ id: string; name: string }>;
  staff: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  defaultServiceId?: string;
  compact?: boolean;
};

export function AvailabilitySlotPreview({
  services,
  staff,
  locations,
  defaultServiceId,
  compact,
}: Props) {
  const [serviceId, setServiceId] = useState(defaultServiceId || services[0]?.id || "");
  const [staffId, setStaffId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [unavailable, setUnavailable] = useState<Array<{ time: string; reason: string }>>([]);

  const serviceName = useMemo(
    () => services.find((s) => s.id === serviceId)?.name || "",
    [serviceId, services],
  );

  const loadSlots = useCallback(async () => {
    if (!serviceName) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        serviceId,
        serviceName,
        daysAhead: "1",
      });
      if (locationId) params.set("locationId", locationId);
      if (staffId) params.set("staffId", staffId);
      const res = await fetch(`/api/appointments/availability?${params}`);
      const json = (await res.json()) as { data?: Slot[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not load slots");
      const daySlots = (json.data || []).filter((slot) => slot.startsAt.startsWith(date));
      const filtered = staffId
        ? daySlots.filter((slot) => !slot.staffId || slot.staffId === staffId)
        : daySlots;
      setSlots(filtered.slice(0, compact ? 8 : 16));

      if (filtered.length === 0 && daySlots.length > 0 && staffId) {
        setUnavailable([{ time: "—", reason: "Selected staff has no slots this day" }]);
      } else if (filtered.length === 0) {
        const explainRes = await fetch(
          `/api/appointments/diagnostics/slots?${new URLSearchParams({
            serviceName,
            startsAt: `${date}T10:00:00`,
            explain: "true",
            ...(staffId ? { staffId } : {}),
          })}`,
        );
        const explainJson = await explainRes.json();
        const reasons = (explainJson.data?.reasons || []) as string[];
        setUnavailable(
          reasons.length
            ? [{ time: "10:00 AM", reason: reasons[0] }]
            : [{ time: "—", reason: "No slots generated for this date" }],
        );
      } else {
        setUnavailable([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [compact, date, locationId, serviceId, serviceName, staffId]);

  useEffect(() => {
    if (serviceId) void loadSlots();
  }, [loadSlots, serviceId]);

  return (
    <div className="ws-panel">
      <div className="ws-panel-head">
        <h2 className="ws-panel-title">Availability preview</h2>
        <p className="ws-panel-subtitle">Uses the same slot engine as public booking.</p>
      </div>
      <div className="grid gap-3 border-b border-[var(--border)] px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="ws-field-label">Service</span>
          <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {services.length === 0 ? <option value="">No services</option> : null}
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="ws-field-label">Staff</span>
          <select className="input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Any eligible</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="ws-field-label">Location</span>
          <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Any</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="ws-field-label">Date</span>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[var(--type-section)] font-semibold text-[var(--text-primary)]">Available</span>
          <button type="button" className="ws-text-btn" onClick={() => void loadSlots()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {error ? <p className="ws-inline-error" role="alert">{error}</p> : null}
        {loading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="h-8 w-20 animate-pulse rounded-md bg-[var(--surface-muted)]" />
            ))}
          </div>
        ) : slots.length ? (
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => {
              const time = slot.startsAt.includes("T")
                ? formatTime12h(slot.startsAt.split("T")[1].slice(0, 5))
                : slot.startsAt;
              return (
                <span key={slot.startsAt} className="ws-chip is-success">
                  {time}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-[var(--type-helper)] text-[var(--text-secondary)]">No available slots for this selection.</p>
        )}
        {unavailable.length ? (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <p className="mb-2 text-[var(--type-section)] font-semibold text-[var(--text-primary)]">Unavailable details</p>
            <ul className="space-y-1">
              {unavailable.map((row) => (
                <li key={`${row.time}-${row.reason}`} className="flex justify-between gap-3 text-[var(--type-list)]">
                  <span className="text-[var(--text-secondary)]">{row.time}</span>
                  <span className="text-[var(--text-primary)]">{row.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
