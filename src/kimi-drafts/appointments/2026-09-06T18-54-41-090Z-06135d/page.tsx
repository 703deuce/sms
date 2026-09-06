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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulates GET /api/appointments?status|from|to&q=
  useEffect(() => {
    setState("loading");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const now = Date.now();
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      let data = [...MOCK_APPOINTMENTS];
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
  }, [tab, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of MOCK_APPOINTMENTS) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, []);

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
      />
    </div>
  );
}
