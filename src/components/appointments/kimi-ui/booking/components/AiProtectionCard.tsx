"use client";

import React, { useState } from "react";
import { ShieldCheck, Shield, ChevronRight } from "lucide-react";
import { protectionLevels } from "../mock-data";

export default function AiProtectionCard() {
  const [level, setLevel] = useState("standard");

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
          {protectionLevels.map((p) => {
            const active = level === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setLevel(p.id)}
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
              background: "#e5f8ee",
              color: "#12834a",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 999,
              padding: "4px 12px",
            }}
          >
            0 to review
          </span>
          <ChevronRight size={16} style={{ color: "#9b99a8" }} />
        </div>
      </div>
    </>
  );
}
