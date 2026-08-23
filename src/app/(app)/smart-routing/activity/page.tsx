"use client";

import { SmartRoutingActivityView } from "@/components/smart-routing/activity-view";
import { useEffect, useState } from "react";

export default function SmartRoutingActivityPage() {
  const [flowId, setFlowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/smart-routing/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const flows = json.data?.flows ?? [];
        const active = flows.find((f: { status: string }) => f.status === "active");
        const fallback = flows[0];
        setFlowId(active?.id ?? fallback?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading activity…</p>;
  }

  if (!flowId) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create and publish a call flow to see inbound routing sessions here. Outbound Business
          Callback history appears once your team starts returning calls.
        </p>
      </div>
    );
  }

  return <SmartRoutingActivityView flowId={flowId} />;
}
