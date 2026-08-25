"use client";

import { SmartRoutingOverviewView } from "@/components/smart-routing/overview-view";
import type { SetupReadiness } from "@/lib/smart-routing/setup-readiness";
import { isCustomerSmartRoutingFlow } from "@/lib/smart-routing/flow-kind";
import type { DraftConfig } from "@/lib/smart-routing/types";
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
  const [workspaceStatus, setWorkspaceStatus] = useState<{
    publicBusinessE164: string | null;
    routingNumberE164: string | null;
    callbackNumberE164: string | null;
    callerIdStatus: string;
    authorizedCallerCount: number;
    outboundBusinessCallbacks?: number;
    primaryFlow?: { id: string; name: string; status: string; type: string } | null;
    readiness: SetupReadiness;
  } | null>(null);
  const [scheduleOverride, setScheduleOverride] = useState<{
    mode?: string;
    expiresAt?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/smart-routing/flows").then((r) => r.json()),
      fetch("/api/smart-routing/templates").then((r) => r.json()),
      fetch("/api/smart-routing/setup").then((r) => r.json()),
      fetch("/api/smart-routing/analytics?days=30").then((r) => r.json()),
    ])
      .then(([flowsJson, templatesJson, setupJson, analyticsJson]) => {
        setFlows(flowsJson.data ?? []);
        setMetrics(flowsJson.metrics ?? null);
        setTemplates(templatesJson.data ?? []);

        const setup = setupJson.data;
        if (setup) {
          const activeFlow = (setup.flows ?? []).find(
            (f: { status: string; type?: string; name?: string }) =>
              f.status === "active" && isCustomerSmartRoutingFlow(f),
          );
          setScheduleOverride(setup.scheduleOverride ?? null);
          setWorkspaceStatus({
            publicBusinessE164: setup.settings?.publicBusinessE164 ?? null,
            routingNumberE164: setup.settings?.routingNumberE164 ?? null,
            callbackNumberE164: setup.settings?.callbackNumberE164 ?? null,
            callerIdStatus: setup.callerId?.status ?? "not_verified",
            authorizedCallerCount: (setup.authorizedCallers ?? []).filter(
              (c: { active: boolean; outboundEnabled: boolean }) =>
                c.active && c.outboundEnabled,
            ).length,
            outboundBusinessCallbacks: analyticsJson.data?.outboundBusinessCallbacks,
            primaryFlow: activeFlow ?? null,
            readiness: setup.readiness,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SmartRoutingOverviewView
      flows={flows}
      metrics={metrics}
      templates={templates}
      workspaceStatus={workspaceStatus}
      scheduleOverride={scheduleOverride}
      onWorkspaceRefresh={load}
    />
  );
}
