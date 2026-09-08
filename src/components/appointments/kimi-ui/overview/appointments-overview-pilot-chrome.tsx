"use client";

import { useEffect } from "react";

const PILOT_HTML_CLASS = "appt-overview-pilot-active";

/** Overview pilot only — toggles full-page charcoal/teal shell while on /appointments/overview. */
export function AppointmentsOverviewPilotChrome({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    document.documentElement.classList.add(PILOT_HTML_CLASS);
    return () => document.documentElement.classList.remove(PILOT_HTML_CLASS);
  }, []);

  return children;
}
