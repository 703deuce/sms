"use client";

import { useState } from "react";
import "./reference.css";
import { PublicBookingClient } from "./components/PublicBookingClient";
import { BookingLoading, BookingError, BookingNotFound } from "./components/BookingStates";
import { Button } from "./components/ui";

type Scenario = "flow" | "loading" | "error" | "notfound";

export default function ReferencePage() {
  const [scenario, setScenario] = useState<Scenario>("flow");
  const [withService, setWithService] = useState(true);

  return (
    <div>
      {/* Sandbox scenario switcher — Cursor removes this when wiring the real route */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur">
        <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">State</span>
        {(
          [
            ["flow", "Booking flow"],
            ["loading", "Loading"],
            ["error", "Error"],
            ["notfound", "Inactive link"],
          ] as Array<[Scenario, string]>
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={scenario === key ? "primary" : "ghost"}
            onClick={() => setScenario(key)}
          >
            {label}
          </Button>
        ))}
        {scenario === "flow" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWithService((v) => !v)}
            title="Toggle /book/[slug] vs /book/[slug]/[serviceId] entry"
          >
            {withService ? "Service preselected" : "From /book/[slug]"}
          </Button>
        ) : null}
      </div>

      {scenario === "flow" ? (
        <PublicBookingClient
          slug="brightline-dental"
          initialServiceId={withService ? "svc-consult" : undefined}
        />
      ) : null}
      {scenario === "loading" ? <BookingLoading /> : null}
      {scenario === "error" ? <BookingError message="" onRetry={() => setScenario("flow")} /> : null}
      {scenario === "notfound" ? <BookingNotFound /> : null}
    </div>
  );
}
