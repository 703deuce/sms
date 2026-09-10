"use client";

import { useRouter } from "next/navigation";
import { Code2 } from "lucide-react";
import { Tabs } from "@/components/integrations/kimi-ui/calendars/components/ui/Tabs";
import { AppointmentsWebhooksPanel } from "@/components/integrations/appointments-webhooks-panel";
import { appointmentsIntegrationsTabs } from "@/lib/products/appointments-settings-tabs";

export default function IntegrationsDeveloperPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-[var(--primary)]" aria-hidden />
            <h1 className="text-[22px] font-bold tracking-tight text-[var(--foreground)]">
              Developer
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-[13px] text-[var(--muted-foreground)]">
            Outbound webhooks and delivery logs for appointment events. API keys remain under the global
            Integrations directory.
          </p>
        </div>

        <Tabs
          items={appointmentsIntegrationsTabs}
          activeHref="/integrations/developer"
          onNavigate={(href) => router.push(href)}
        />

        <AppointmentsWebhooksPanel />
      </div>
    </main>
  );
}
