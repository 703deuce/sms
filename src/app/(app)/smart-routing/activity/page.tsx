"use client";

import { SmartRoutingActivityView } from "@/components/smart-routing/activity-view";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SmartRoutingActivityPage() {
  const [flowId, setFlowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [outboundCount, setOutboundCount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/smart-routing/setup", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/smart-routing/outbound-calls?limit=1", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([setupJson, outboundJson]) => {
        const flows = setupJson.data?.flows ?? [];
        const active = flows.find((f: { status: string }) => f.status === "active");
        const fallback = flows[0];
        setFlowId(active?.id ?? fallback?.id ?? null);
        setOutboundCount((outboundJson.data ?? []).length);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading activity…</p>;
  }

  if (!flowId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Routing Activity</h1>
        <p className="text-sm text-muted-foreground">
          Your call log appears here once Smart Routing is live. Publish a call flow so inbound
          calls are tracked, or use Business Call Back to return outbound calls from your team phones.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/smart-routing/flows"
            className="rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white"
          >
            Set up call flows
          </Link>
          <Link
            href="/smart-routing/callback"
            className="rounded-lg border border-[#e5e7eb] px-4 py-2 text-sm font-semibold text-[#374151]"
          >
            Business Call Back
          </Link>
        </div>
        {outboundCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            Outbound business callbacks are already being recorded — open Business Call Back for
            history.
          </p>
        ) : null}
      </div>
    );
  }

  return <SmartRoutingActivityView flowId={flowId} />;
}
