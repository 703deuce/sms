"use client";

import "./reference.css";
import { useState } from "react";
import { BookingShell } from "./components/BookingShell";
import { PublicBookingClient } from "./components/PublicBookingClient";
import { bookingTypes } from "./mock-data";

type PreviewMode = "book" | "service" | "disabled" | "returning" | "challenge";

export default function ReferencePage() {
  const [mode, setMode] = useState<PreviewMode>("book");

  const returningVisitor = mode === "returning"
    ? { firstName: "Jordan", lastName: "Lee", phone: "(571) 555-0198", email: "jordan@example.com" }
    : null;

  return (
    <BookingShell>
      <div className="mx-auto mb-5 flex max-w-full flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1 text-[12px] font-medium shadow-sm">
        {([
          ["book", "/book/brightline-dental"],
          ["service", "Preselected service"],
          ["returning", "Returning visitor"],
          ["challenge", "Fraud challenge"],
          ["disabled", "Booking disabled"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              mode === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "disabled" ? (
        <PublicBookingClient bookingDisabled />
      ) : mode === "service" ? (
        <PublicBookingClient initialServiceId={bookingTypes[0].id} />
      ) : (
        <PublicBookingClient
          returningVisitor={returningVisitor}
          requireChallenge={mode === "challenge"}
        />
      )}
    </BookingShell>
  );
}
