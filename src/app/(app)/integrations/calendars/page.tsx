"use client";

import { CalendarIntegrationsCard } from "@/components/integrations/calendar-integrations-card";
import { Tabs } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";
import Link from "next/link";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "Calendars", href: "/integrations/calendars" },
  { label: "Connect apps", href: "/integrations/native" },
  { label: "CRM", href: "/integrations/crm" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

export default function CalendarIntegrationsPage() {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-violet-600">
          <Calendar className="h-5 w-5" />
          <h1 className="text-[22px] font-bold tracking-tight text-[#1a1d29]">Calendar integrations</h1>
        </div>
        <p className="mt-1 text-[13px] text-[#8a8fa3]">
          Connect Google and Microsoft calendars at the workspace level. These connections power
          Transovo scheduling, availability, reminders, and workflows — not just voice.
        </p>
        <p className="mt-2 text-[12px] text-[#8a8fa3]">
          Appointments and AI products consume these connections.{" "}
          <Link href="/appointments/calendar" className="font-medium text-primary hover:underline">
            Open Transovo calendar →
          </Link>
        </p>
      </div>

      <Tabs items={integrationTabs} />

      <div className="max-w-2xl">
        <CalendarIntegrationsCard />
      </div>
    </div>
  );
}
