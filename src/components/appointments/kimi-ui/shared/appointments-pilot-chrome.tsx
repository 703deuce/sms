"use client";

import { useEffect } from "react";

const PILOT_HTML_CLASS = "appt-overview-pilot-active";

/** Appointments product theme — charcoal/teal + Geist on shell and content. */
export function AppointmentsPilotChrome({
  children,
  fontVariableClass,
}: Readonly<{ children: React.ReactNode; fontVariableClass: string }>) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(PILOT_HTML_CLASS, fontVariableClass);
    return () => {
      root.classList.remove(PILOT_HTML_CLASS, fontVariableClass);
    };
  }, [fontVariableClass]);

  return children;
}
