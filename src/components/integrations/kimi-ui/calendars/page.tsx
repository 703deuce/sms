"use client";

import { useState } from "react";
import { ArrowRight, Calendar } from "lucide-react";
import { CalendarIntegrationsCard } from "./components/CalendarIntegrationsCard";
import { Tabs } from "./components/ui/Tabs";

// From src/lib/products/appointments-settings-tabs.ts (appointmentsIntegrationsTabs)
const integrationsTabs = [
  { label: "Calendars", href: "/integrations/calendars" },
  { label: "Payments", href: "/integrations/payments" },
];

export default function CalendarIntegrationsPage() {
  const [activeTab, setActiveTab] = useState("/integrations/calendars");

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Page header — title top-left, context below (Page Architecture Rules 3) */}
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[var(--primary)]" aria-hidden />
            <h1 className="text-[22px] font-bold tracking-tight text-[var(--foreground)]">
              Calendar integrations
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-[13px] text-[var(--muted-foreground)]">
            Connect Google and Microsoft calendars at the workspace level. These connections power
            Transovo scheduling, availability, reminders, and workflows.
          </p>
          <p className="mt-2 text-[12px]">
            <a
              href="/appointments/calendar"
              className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
            >
              Open calendar <ArrowRight className="h-3 w-3" aria-hidden />
            </a>
          </p>
        </div>

        <Tabs items={integrationsTabs} activeHref={activeTab} onNavigate={setActiveTab} />

        <div className="max-w-2xl">
          <CalendarIntegrationsCard />
        </div>
      </div>
    </main>
  );
}
