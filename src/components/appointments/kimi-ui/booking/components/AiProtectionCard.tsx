"use client";

import React from "react";
import { ShieldCheck, Shield, ChevronRight } from "lucide-react";
import type { BookingPageModel } from "@/features/appointments/kimi/booking/types";
import type { BookingProtectionMode } from "@/lib/appointments/types";

type Props = {
  protectionMode: BookingProtectionMode;
  protectionOptions: BookingPageModel["protectionOptions"];
  suspiciousBookings: BookingPageModel["suspiciousBookings"];
  onModeChange: (mode: BookingProtectionMode) => void;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AiProtectionCard({
  protectionMode,
  protectionOptions,
  suspiciousBookings,
  onModeChange,
}: Props) {
  const reviewCount = suspiciousBookings.length;

  return (
    <>
      <div className="booking-card">
        <div className="booking-card-header">
          <div className="booking-card-title-row">
            <div className="booking-card-icon">
              <ShieldCheck size={14} />
            </div>
            <div>
              <h3 className="booking-card-title">AI Booking Protection</h3>
              <p className="booking-card-desc">
                Screen public bookings for spam, bots, and suspicious patterns before they hit your calendar.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 18 }}>
          {protectionOptions.map((p) => {
            const active = protectionMode === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onModeChange(p.id)}
                style={{
                  textAlign: "left",
                  border: `1.5px solid ${active ? "#5b3df0" : "#e2e0ec"}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  background: active ? "#f7f5fe" : "#ffffff",
                  cursor: "pointer",
                  transition: "border-color .15s, background .15s",
                  position: "relative",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#17161f" }}>
                  {active ? (
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "#5b3df0",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  ) : (
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: "1.5px solid #d6d3e2",
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                  )}
                  {p.name}
                </span>
                <span style={{ display: "block", fontSize: 11.5, color: "#6f6d7c", marginTop: 6, lineHeight: 1.4 }}>
                  {p.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="booking-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div className="booking-card-title-row">
          <div className="booking-card-icon">
            <Shield size={14} />
          </div>
          <div>
            <h3 className="booking-card-title">Review suspicious bookings</h3>
            <p className="booking-card-desc">Bookings flagged by AI Booking Protection will appear here for review.</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              background: reviewCount > 0 ? "#fff4e5" : "#e5f8ee",
              color: reviewCount > 0 ? "#b45309" : "#12834a",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 999,
              padding: "4px 12px",
            }}
          >
            {reviewCount} to review
          </span>
          <ChevronRight size={16} style={{ color: "#9b99a8" }} />
        </div>
      </div>

      {reviewCount > 0 ? (
        <div className="booking-card">
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {suspiciousBookings.map((b) => (
              <li
                key={b.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid #ececf3",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#17161f" }}>
                    {b.serviceName || "Booking"} · {formatDateTime(b.at)}
                  </div>
                  {b.signals?.length ? (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#6f6d7c" }}>
                      {b.signals.slice(0, 3).join(" · ")}
                    </div>
                  ) : null}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#6f6d7c", textTransform: "capitalize" }}>
                  {b.riskLevel} · {b.action}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
