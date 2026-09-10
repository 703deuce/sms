"use client";

import { AppointmentsAnalyticsClient } from "@/components/appointments/analytics-client";
import { Tabs } from "@/components/ui/tabs";
import { appointmentsAnalyticsTabs } from "@/lib/products/appointments-settings-tabs";

import type { AppointmentsAnalyticsSection } from "@/lib/products/appointments-settings-tabs";

export function AppointmentsAnalyticsShell({
  section = "overview",
  reportFocus,
  reportFrom,
  reportTo,
  reportStatus,
}: {
  section?: AppointmentsAnalyticsSection;
  reportFocus?: "service-booking";
  reportFrom?: string;
  reportTo?: string;
  reportStatus?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <Tabs items={appointmentsAnalyticsTabs} />
      <AppointmentsAnalyticsClient
        section={section}
        reportFocus={reportFocus}
        reportFrom={reportFrom}
        reportTo={reportTo}
        reportStatus={reportStatus}
      />
    </div>
  );
}
