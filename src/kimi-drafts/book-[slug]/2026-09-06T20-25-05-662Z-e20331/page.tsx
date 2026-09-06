"use client";

import "./reference.css";
import { useState } from "react";
import { BookingShell } from "./components/BookingShell";
import { PublicBookingClient } from "./components/PublicBookingClient";
import { bookingTypes } from "./mock-data";

export default function ReferencePage() {
  // Sandbox router: simulate /book/[slug] vs /book/[slug]/[serviceId]
  const [route, setRoute] = useState<"book" | "service">("book");

  return (
    <BookingShell>
      {/* Sandbox route switcher (not part of production UI) */}
      <div className="mx-auto mb-5 flex max-w-fit items-center gap-1 rounded-full border border-border bg-card p-1 text-[12px] font-medium shadow-sm">
        <button
          onClick={() => setRoute("book")}
          className={`rounded-full px-3 py-1.5 transition-colors ${route === "book" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          /book/brightline-dental
        </button>
        <button
          onClick={() => setRoute("service")}
          className={`rounded-full px-3 py-1.5 transition-colors ${route === "service" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          /book/brightline-dental/{bookingTypes[0].id}
        </button>
      </div>

      {route === "book" ? (
        <PublicBookingClient />
      ) : (
        <PublicBookingClient initialServiceId={bookingTypes[0].id} />
      )}
    </BookingShell>
  );
}
