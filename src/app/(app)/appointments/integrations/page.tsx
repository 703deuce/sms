"use client";

import { useEffect, useState } from "react";
import { CalendarIntegrationsCard } from "@/components/appointments/calendar-integrations-card";

export default function AppointmentIntegrationsPage() {
  const [status, setStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/appointments/integrations/status")
      .then((r) => r.json())
      .then((json) => setStatus(json.data || {}))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f8fb] p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#1a1d29]">Integrations</h1>
          <p className="text-[13px] text-[#8a8fa3] mt-1">
            Connect external calendars and view provider configuration status.
          </p>
        </div>
        <CalendarIntegrationsCard />
        <div className="rounded-xl border border-[#ecedf2] bg-white p-5">
          <h3 className="text-[14px] font-semibold mb-3">Provider status</h3>
          <ul className="space-y-2 text-[13px]">
            <StatusRow label="Google Calendar OAuth" ok={status.googleCalendarConfigured} />
            <StatusRow label="OpenAI (AI booking)" ok={status.openAiConfigured} fallback="Deterministic fallback active" />
            <StatusRow label="Brevo (workflow email)" ok={status.brevoConfigured} fallback="Email actions stub when unconfigured" />
            <StatusRow label="Stripe (payments)" ok={status.stripeConfigured} fallback="Payments unavailable until configured" />
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, ok, fallback }: { label: string; ok?: boolean; fallback?: string }) {
  return (
    <li className="flex items-center justify-between py-2 border-b border-[#ecedf2] last:border-0">
      <span>{label}</span>
      <span className={ok ? "text-emerald-600 font-medium" : "text-amber-700 text-[12px]"}>
        {ok ? "Configured" : fallback || "Not configured"}
      </span>
    </li>
  );
}
