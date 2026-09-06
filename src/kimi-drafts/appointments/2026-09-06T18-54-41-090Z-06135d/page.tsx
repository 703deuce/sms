"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppointmentsList } from "./components/AppointmentsList";
import type { AppointmentRow } from "./mock-data";
import { MOCK_APPOINTMENTS } from "./mock-data";
import "./reference.css";

type LoadState = "loading" | "ready" | "error" | "empty";

export default function ReferencePage() {
  const [tab, setTab] = useState<string>("upcoming");
  const [q, setQ] = useState("");
  const [state, setState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [local, setLocal] = useState<AppointmentRow[]>(MOCK_APPOINTMENTS);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulates GET /api/appointments?status|from|to&q=
  useEffect(() => {
    setState("loading");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const now = Date.now();
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      let data = [...local];
      if (tab === "today") {
        data = data.filter((r) => {
          const t = new Date(r.startsAt).getTime();
          return t >= start.getTime() && t <= end.getTime();
        });
      } else if (tab === "upcoming") {
        data = data.filter((r) => new Date(r.startsAt).getTime() >= now && !["canceled", "completed", "no_show"].includes(r.status));
      } else if (tab === "past") {
        data = data.filter((r) => new Date(r.startsAt).getTime() < now);
      } else if (tab !== "all") {
        data = data.filter((r) => r.status === tab);
      }
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        data = data.filter((r) =>
          [r.inviteeName, r.inviteePhone, r.inviteeEmail, r.serviceName]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle)),
        );
      }
      data.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
      setRows(data);
      setState("ready");
    }, 450);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [tab, q, local]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of local) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [local]);

  const handleCreated = (row: AppointmentRow) => setLocal((l) => [...l, row]);
  const handleCanceled = (id: string) =>
    setLocal((l) =>
      l.map((r) =>
        r.id === id
          ? { ...r, status: "canceled", reminderStatus: "suppressed", metadata: { ...r.metadata, reminderSchedule: (r.metadata.reminderSchedule ?? []).map((s) => (s.state === "scheduled" ? { ...s, state: "suppressed" as const } : s)) } }
          : r,
      ),
    );
  const handleRescheduled = (id: string, startsAt: string) =>
    setLocal((l) => l.map((r) => (r.id === id ? { ...r, startsAt, status: "scheduled" } : r)));

  return (
    <div className="tv-page">
      <AppointmentsList
        tab={tab}
        onTabChange={setTab}
        q={q}
        onSearch={setQ}
        state={state}
        rows={rows}
        counts={counts}
        onRetry={() => setTab((t) => t)}
        onSimulateError={() => setState("error")}
        onSimulateEmpty={() => setState("empty")}
        onCreated={handleCreated}
        onCanceled={handleCanceled}
        onRescheduled={handleRescheduled}
      />
    </div>
  );
}
