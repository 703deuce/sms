"use client";

import { useEffect, useState } from "react";
import type { Appointment } from "../types";
import { Card, SectionHeader, StatusChip, InlineEmpty, formatAppointmentWhen } from "./ui";
import { ArrowUpRight, CalendarClock } from "lucide-react";

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--muted-foreground)",
        }}
      >
        {children}
      </h3>
      {typeof count === "number" && count > 0 ? (
        <span
          style={{
            borderRadius: 999,
            background: "var(--muted)",
            padding: "2px 7px",
            fontSize: 10,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: "var(--muted-foreground)",
          }}
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}

function AppointmentRow({ appt, upcoming }: { appt: Appointment; upcoming: boolean }) {
  return (
    <a
      href={`#/appointments/${appt.id}`}
      className="row-hover"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--card)",
        padding: "10px 14px",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span
          style={{
            display: "flex",
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            flexShrink: 0,
            background: upcoming ? "rgba(67,56,202,0.1)" : "var(--muted)",
            color: upcoming ? "var(--primary)" : "var(--muted-foreground)",
          }}
        >
          <CalendarClock style={{ width: 14, height: 14 }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {appt.serviceName || "Appointment"}
          </p>
          <p style={{ margin: 0, fontSize: 12, fontVariantNumeric: "tabular-nums", color: "var(--muted-foreground)" }}>
            {formatAppointmentWhen(appt.startsAt)}
          </p>
        </div>
      </div>
      <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <StatusChip status={appt.status} />
        <ArrowUpRight style={{ width: 14, height: 14, color: "var(--muted-foreground)" }} />
      </span>
    </a>
  );
}

export function ContactAppointmentsPanel({ contactId }: { contactId: string }) {
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [past, setPast] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contacts/${contactId}/crm-context`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setUpcoming(json.data?.upcomingAppointments || []);
        setPast(json.data?.pastAppointments || []);
      })
      .catch(() => {
        if (cancelled) return;
        setUpcoming([]);
        setPast([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader
        icon={<CalendarClock />}
        title="Appointments"
        description="Upcoming and past appointments for this contact."
      />
      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div style={{ display: "grid", gap: 8 }}>
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8 }} />
                  <div style={{ flex: 1, display: "grid", gap: 6 }}>
                    <div className="skeleton" style={{ height: 10, width: 150 }} />
                    <div className="skeleton" style={{ height: 10, width: 96 }} />
                  </div>
                </div>
                <div className="skeleton" style={{ height: 20, width: 80 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 20 }}>
            <div>
              <SectionLabel count={upcoming.length}>Upcoming</SectionLabel>
              {upcoming.length === 0 ? (
                <InlineEmpty>No upcoming appointments.</InlineEmpty>
              ) : (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {upcoming.map((a) => (
                    <AppointmentRow key={a.id} appt={a} upcoming />
                  ))}
                </div>
              )}
            </div>
            <div>
              <SectionLabel count={past.length}>History</SectionLabel>
              {past.length === 0 ? (
                <InlineEmpty>No past appointments.</InlineEmpty>
              ) : (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {past.slice(0, 8).map((a) => (
                    <AppointmentRow key={a.id} appt={a} upcoming={false} />
                  ))}
                </div>
              )}
            </div>
            <a
              href="#/appointments"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--primary)",
                textDecoration: "none",
              }}
            >
              View all appointments
              <ArrowUpRight style={{ width: 14, height: 14 }} />
            </a>
          </div>
        )}
      </div>
    </Card>
  );
}
