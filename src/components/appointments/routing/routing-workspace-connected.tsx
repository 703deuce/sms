"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, GitBranch } from "lucide-react";
import { useRoutingWorkspace } from "@/features/appointments/kimi/routing/use-routing-workspace";
import { TypeRoutingRulesPanel } from "@/features/appointments/kimi/routing/type-routing-rules-panel";
import { ROUTING_SECTIONS, type RoutingSectionId } from "./routing-section-types";
import { RoutingOverviewSection } from "./routing-overview-section";
import { RoutingRulesSection } from "./routing-rules-section";
import { RoutingPoolsSection } from "./routing-pools-section";
import { RoutingServicesSection } from "./routing-services-section";
import { RoutingTestSection } from "./routing-test-section";
import { RoutingActivitySection } from "./routing-activity-section";
import { RoutingSettingsSection } from "./routing-settings-section";
import { RoutingServiceDrawer } from "./routing-service-drawer";
import type { StaffRoutingConfig } from "@/lib/appointments/types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

export function RoutingWorkspaceConnected() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as RoutingSectionId) || "overview";
  const ws = useRoutingWorkspace();
  const [serviceDrawerId, setServiceDrawerId] = useState<string | null>(null);
  const [priorityDraft, setPriorityDraft] = useState<string[] | null>(null);

  const setSection = useCallback(
    (id: RoutingSectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/routing?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const priorityOrder = useMemo(() => {
    if (priorityDraft) return priorityDraft;
    return ws.data?.staffRouting.workspaceStaffPriorityOrder?.length
      ? ws.data.staffRouting.workspaceStaffPriorityOrder
      : ws.data?.staff.map((s) => s.id) || [];
  }, [priorityDraft, ws.data]);

  const persistRouting = useCallback(
    async (patch: { staffRouting: StaffRoutingConfig; workspaceStaffPriorityOrder?: string[] }) => {
      await ws.saveWorkspaceRouting(patch);
      setPriorityDraft(null);
    },
    [ws],
  );

  if (ws.loading) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="mx-auto max-w-[1560px] animate-pulse space-y-3">
          <div className="h-10 w-48 rounded bg-[var(--surface)]" />
          <div className="h-10 rounded bg-[var(--surface)]" />
          <div className="h-80 rounded bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  if (!ws.data) {
    return (
      <div className={`${SHELL} flex min-h-full items-center justify-center bg-[var(--surface-muted)] p-8`}>
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-[var(--accent)]" />
          <p className="mt-2 text-sm text-[var(--text-primary)]">{ws.error || "Could not load routing"}</p>
          <button type="button" className="appt-pilot-primary-btn mt-4" onClick={() => ws.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const data = ws.data;

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto flex w-full max-w-[1560px] flex-col">
        <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="ws-event-head-main flex min-w-0 items-start gap-3">
              <span className="ws-icon-tile mt-0.5" aria-hidden>
                <GitBranch className="h-4 w-4" />
              </span>
              <div>
                <h1 className="ws-event-title">Routing</h1>
                <p className="ws-event-subtitle">
                  Control how eligible bookings are automatically assigned to staff.
                </p>
              </div>
            </div>
            <button type="button" className="appt-pilot-secondary-btn text-xs" onClick={() => setSection("test")}>
              Test routing
            </button>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Routing sections">
            {ROUTING_SECTIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                  section === tab.id
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                }`}
                onClick={() => setSection(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        {ws.error && (
          <p className="mx-4 mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 lg:mx-6">
            {ws.error}
          </p>
        )}

        {section === "overview" && (
          <RoutingOverviewSection
            data={data}
            onEditDefault={() => setSection("rules")}
            onViewServices={() => setSection("services")}
            onViewActivity={() => setSection("activity")}
          />
        )}
        {section === "rules" && (
          <RoutingRulesSection
            staffRouting={data.staffRouting}
            staff={data.staff}
            priorityOrder={priorityOrder}
            saving={ws.saving}
            onChange={(patch) => void persistRouting(patch)}
            onReorderPriority={(next) => {
              setPriorityDraft(next);
              void persistRouting({
                staffRouting: data.staffRouting,
                workspaceStaffPriorityOrder: next,
              });
            }}
          />
        )}
        {section === "pools" && <RoutingPoolsSection data={data} />}
        {section === "services" && (
          <RoutingServicesSection data={data} onSelect={(id) => setServiceDrawerId(id)} />
        )}
        {section === "test" && (
          <RoutingTestSection
            data={data}
            simulating={ws.simulating}
            result={ws.simulateResult}
            onRun={(input) => void ws.runSimulate(input)}
          />
        )}
        {section === "activity" && <RoutingActivitySection data={data} />}
        {section === "settings" && (
          <RoutingSettingsSection
            staffRouting={data.staffRouting}
            saving={ws.saving}
            onChange={(patch) => void persistRouting(patch)}
          />
        )}
        {section === "type-rules" && <TypeRoutingRulesPanel />}
      </div>

      <RoutingServiceDrawer serviceId={serviceDrawerId} data={data} onClose={() => setServiceDrawerId(null)} />
    </div>
  );
}
