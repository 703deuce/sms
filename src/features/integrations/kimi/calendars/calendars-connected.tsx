"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Calendar } from "lucide-react";
import "@/components/integrations/kimi-ui/calendars/reference.css";
import { CalendarIntegrationsCard } from "@/components/integrations/calendar-integrations-card";
import { Tabs } from "@/components/integrations/kimi-ui/calendars/components/ui/Tabs";
import { appointmentsIntegrationsTabs } from "@/lib/products/appointments-settings-tabs";

export function CalendarIntegrationsConnected() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
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
            <Link
              href="/appointments/calendar"
              className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
            >
              Open calendar <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </p>
        </div>

        <Tabs
          items={appointmentsIntegrationsTabs}
          activeHref="/integrations/calendars"
          onNavigate={(href) => router.push(href)}
        />

        <div className="max-w-2xl space-y-4">
          <CalendarIntegrationsCard />
          <p className="text-[12px] text-[var(--muted-foreground)]">
            Appointment outbound webhooks and delivery logs live under{" "}
            <Link href="/integrations/developer" className="font-medium text-[var(--primary)] hover:underline">
              Integrations → Developer
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
