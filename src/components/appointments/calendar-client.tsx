"use client";

import { Suspense } from "react";
import { CalendarConnected } from "@/features/appointments/kimi/calendar/calendar-connected";

export { CalendarConnected };

export function AppointmentsCalendarClient() {
  return (
    <Suspense fallback={<div className="cal-page min-h-screen animate-pulse bg-[#f7f8fa]" aria-busy="true" />}>
      <CalendarConnected />
    </Suspense>
  );
}
