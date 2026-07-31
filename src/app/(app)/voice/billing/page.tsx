"use client";

import { Card, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { formatNumber } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function VoiceBillingPage() {
  const [analytics, setAnalytics] = useState<{
    totalCostCents: number;
    aiMinutes: number;
    telephonyMinutes: number;
    totalCalls: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/voice/analytics?days=30")
      .then((r) => r.json())
      .then((j) => setAnalytics(j.data))
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <PageHeader
        title="Usage & billing"
        description="Voice minutes, AI usage, number costs, and spending limits."
      />
      <VoiceSubNav />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="30-day voice cost"
          value={`$${((analytics?.totalCostCents ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard label="AI minutes" value={analytics?.aiMinutes?.toFixed(1) ?? "0"} />
        <StatCard label="Telephony minutes" value={analytics?.telephonyMinutes?.toFixed(1) ?? "0"} />
        <StatCard label="Calls (30d)" value={formatNumber(analytics?.totalCalls ?? 0)} />
      </div>

      <Card className="p-5 space-y-2">
        <h2 className="font-medium">Billing notes</h2>
        <p className="text-sm text-muted-foreground">
          Usage is aggregated from call costs and voice usage records. Telnyx telephony and AI
          assistant minutes are billed per your Telnyx account. Set spending alerts in Telnyx
          Mission Control and use emergency stop in Voice settings to halt outbound activity.
        </p>
      </Card>
    </div>
  );
}
