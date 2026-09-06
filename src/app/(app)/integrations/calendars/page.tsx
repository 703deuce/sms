"use client";

import { CalendarIntegrationsCard } from "@/components/integrations/calendar-integrations-card";
import { Tabs } from "@/components/ui/tabs";
import { appointmentsIntegrationsTabs } from "@/lib/products/appointments-settings-tabs";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";
import { Calendar } from "lucide-react";
import Link from "next/link";

const legacyIntegrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "Calendars", href: "/integrations/calendars" },
  { label: "Connect apps", href: "/integrations/native" },
  { label: "CRM", href: "/integrations/crm" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

export default function CalendarIntegrationsPage() {
  const tabs = isAppointmentsV1Primary() ? appointmentsIntegrationsTabs : legacyIntegrationTabs;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-violet-600">
          <Calendar className="h-5 w-5" />
          <h1 className="text-[22px] font-bold tracking-tight text-[#1a1d29]">Calendar integrations</h1>
        </div>
        <p className="mt-1 text-[13px] text-[#8a8fa3]">
          Connect Google and Microsoft calendars at the workspace level. These connections power
          Transovo scheduling, availability, reminders, and workflows.
        </p>
        <p className="mt-2 text-[12px] text-[#8a8fa3]">
          <Link href="/appointments/calendar" className="font-medium text-primary hover:underline">
            Open calendar →
          </Link>
        </p>
      </div>

      <Tabs items={tabs} />

      <div className="max-w-2xl">
        <CalendarIntegrationsCard />
      </div>
    </div>
  );
}
