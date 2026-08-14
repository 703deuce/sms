"use client";

import { SmartRoutingOverviewView } from "@/components/smart-routing/overview-view";
import type { DraftConfig } from "@/lib/smart-routing/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type FlowRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  updatedAt: string;
  todayCalls?: number;
  assignedPhoneNumberId?: string | null;
  businessNumberE164?: string | null;
  draftConfigJson?: DraftConfig;
};

export default function SmartRoutingOverviewPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [metrics, setMetrics] = useState<{
    activeFlows: number;
    routedToday: number;
    recovered: number;
    failures: number;
  } | null>(null);
  const [templates, setTemplates] = useState<
    Array<{ type: string; title: string; subtitle: string; bestFor: string[] }>
  >([]);
  const [numberMap, setNumberMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/smart-routing/flows").then((r) => r.json()),
      fetch("/api/smart-routing/templates").then((r) => r.json()),
      fetch("/api/numbers").then((r) => r.json()),
    ])
      .then(([flowsJson, templatesJson, numbersJson]) => {
        setFlows(flowsJson.data ?? []);
        setMetrics(flowsJson.metrics ?? null);
        setTemplates(templatesJson.data ?? []);
        const nums = numbersJson.data ?? numbersJson.numbers ?? [];
        const map: Record<string, string> = {};
        for (const n of nums) {
          if (n.id && n.e164) map[n.id] = n.e164;
        }
        setNumberMap(map);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onPause(id: string) {
    await fetch(`/api/smart-routing/flows/${id}/pause`, { method: "POST" });
    load();
  }

  async function onDuplicate(id: string) {
    const res = await fetch(`/api/smart-routing/flows/${id}/duplicate`, { method: "POST" });
    const json = await res.json();
    if (json.data?.id) router.push(`/smart-routing/${json.data.id}`);
    else load();
  }

  return (
    <SmartRoutingOverviewView
      flows={flows}
      metrics={metrics}
      templates={templates}
      numberMap={numberMap}
      loading={loading}
      onPause={onPause}
      onDuplicate={onDuplicate}
    />
  );
}
