import { CalendarIntegrationsCard } from "@/components/integrations/calendar-integrations-card";
import { Card, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { getSettingsTabs } from "@/lib/settings-tabs";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export default function SettingsCalendarPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Calendar settings"
        description="Workspace defaults for calendar write, blocking, and import behavior."
      />
      <Tabs items={getSettingsTabs()} />
      <Card className="p-5">
        <CardTitle className="text-base">Calendar connections</CardTitle>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Connect Microsoft 365, Outlook, and Google calendars under Integrations. This page covers
          organization defaults once calendars are connected.
        </p>
        <Link
          href="/integrations/calendars"
          className="mt-4 inline-flex text-[13px] font-semibold text-primary hover:underline"
        >
          Open calendar integrations
        </Link>
      </Card>
      <div className="max-w-2xl">
        <CalendarIntegrationsCard />
      </div>
    </div>
  );
}
