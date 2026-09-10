"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "@/components/appointments/kimi-ui/list/reference.css";
import { AppointmentsList } from "@/components/appointments/kimi-ui/list/components/AppointmentsList";
import type { AppointmentRow } from "@/components/appointments/kimi-ui/list/list-types";

function tabQuery(tab: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const params = new URLSearchParams();
  if (tab === "today") {
    params.set("from", startOfDay.toISOString());
    params.set("to", endOfDay.toISOString());
  } else if (tab === "upcoming") {
    params.set("from", now.toISOString());
  } else if (tab === "past") {
    params.set("to", now.toISOString());
  } else if (tab === "pending_approval") {
    params.set("pendingApproval", "1");
  } else if (tab !== "all") {
    params.set("status", tab);
  }
  return params;
}

export function ListConnected() {
  const router = useRouter();
  const [tab, setTab] = useState("upcoming");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [allRows, setAllRows] = useState<AppointmentRow[]>([]);
  const [bookingTypes, setBookingTypes] = useState<
    Array<{ id: string; name: string; durationMinutes: number; location?: string | null }>
  >([]);
  const [staffNames, setStaffNames] = useState<string[]>(["You"]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "empty">("loading");

  const load = useCallback(() => {
    setState("loading");
    const params = tabQuery(tab);
    if (q.trim()) params.set("q", q.trim());
    fetch(`/api/appointments?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((json) => {
        const data = (json.data || []) as AppointmentRow[];
        setRows(data);
        setState(data.length === 0 && tab === "all" && !q.trim() ? "empty" : "ready");
      })
      .catch(() => setState("error"));
  }, [q, tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/appointments/types")
      .then((r) => r.json())
      .then((json) => {
        const types = (json.data || []).map((t: { id: string; name: string; durationMinutes?: number; location?: string }) => ({
          id: t.id,
          name: t.name,
          durationMinutes: t.durationMinutes ?? 30,
          location: t.location ?? null,
        }));
        setBookingTypes(types);
      })
      .catch(() => {});
    fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        const staff = (json.data?.staff || [])
          .map((s: { name?: string }) => s.name)
          .filter(Boolean) as string[];
        if (staff.length) setStaffNames(staff);
      })
      .catch(() => {});
    fetch("/api/appointments")
      .then((r) => r.json())
      .then((json) => setAllRows(json.data || []))
      .catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of allRows) {
      c[row.status] = (c[row.status] || 0) + 1;
      if (row.metadata?.pendingApproval) {
        c.pending_approval = (c.pending_approval || 0) + 1;
      }
    }
    return c;
  }, [allRows]);

  const createAppointment = useCallback(
    async (payload: {
      inviteeName: string;
      inviteePhone: string | null;
      inviteeEmail: string | null;
      serviceName: string;
      startsAt: string;
      staffName: string;
      notes: string;
      sendSms: boolean;
    }) => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteeName: payload.inviteeName,
          inviteePhone: payload.inviteePhone,
          inviteeEmail: payload.inviteeEmail,
          serviceName: payload.serviceName,
          startsAt: payload.startsAt,
          staffName: payload.staffName,
          internalNote: payload.notes || undefined,
          sendConfirmation: payload.sendSms,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not create appointment");
      }
      load();
    },
    [load],
  );

  const cancelAppointment = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "canceled" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not cancel appointment");
      }
      load();
    },
    [load],
  );

  const rescheduleAppointment = useCallback(
    async (id: string, startsAt: string) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not reschedule appointment");
      }
      load();
    },
    [load],
  );

  const approvalAction = useCallback(
    async (id: string, action: "approve" | "reject") => {
      const res = await fetch("/api/appointments/booking/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, action }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not update approval");
      }
      load();
    },
    [load],
  );

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
        onRetry={load}
        bookingTypes={bookingTypes}
        staffNames={staffNames}
        onCreateAppointment={createAppointment}
        onCanceled={cancelAppointment}
        onRescheduled={rescheduleAppointment}
        onApprovalAction={approvalAction}
        onNavigateToDetail={(id) => router.push(`/appointments/${id}`)}
        onNavigateToMessage={(row) => {
          if (row.contact?.id) {
            router.push(`/conversations?contactId=${row.contact.id}`);
            return;
          }
          router.push("/conversations");
        }}
        onNavigateToBooking={() => router.push("/appointments/booking")}
      />
    </div>
  );
}
