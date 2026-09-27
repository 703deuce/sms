"use client";

import {
  getWizardActivationIssues,
  hasBlockingActivationIssues,
} from "@/lib/solutions/appointment-receptionist/capability-checklist";
import { resolveLiveCalendar } from "@/lib/solutions/appointment-receptionist/live-calendar";
import { buildWizardReadinessRows } from "@/lib/solutions/appointment-receptionist/wizard-readiness";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";
import { formatPhone } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/newui-transplant/components/app/kit";
import { pickWizardFieldComponents } from "../wizard-field-kit";
import { InfoCallout, SidePanel, StatusPill } from "../ui";

function formatBusinessHoursSummary(state: AppointmentReceptionistWizardState): string {
  const m = ensureWizardOperatingMaturity(state);
  const tz = m.businessSchedule.timezone || state.timezone || "America/New_York";
  const openDays = (["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const)
    .filter((day) => {
      const row = m.businessSchedule.weekly[day];
      return row && !row.closed && row.ranges?.length;
    });
  if (!openDays.length) return `Hours not set (${tz})`;
  const label =
    openDays.length === 5 &&
    !openDays.includes("saturday") &&
    !openDays.includes("sunday")
      ? "Mon – Fri"
      : `${openDays.length} days/week`;
  const first = m.businessSchedule.weekly[openDays[0]!]?.ranges?.[0];
  const range =
    first?.start && first?.end ? `${first.start} – ${first.end}` : "see Business Knowledge";
  return `${label}, ${range} (${tz})`;
}

export function ActivateStep({
  state,
  patch,
  onActivate,
  onGoToTest,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  onActivate?: () => void | Promise<void>;
  onGoToTest?: () => void;
  presentation?: "legacy" | "mctb" | "opus";
}) {
  const isMctb = presentation === "mctb";
  const isOpus = presentation === "opus";
  const uiVariant = isOpus ? "opus" : "legacy";
  const { Button } = pickWizardFieldComponents(presentation);
  const phone = state.phoneNumberE164
    ? formatPhone(state.phoneNumberE164)
    : "No number assigned";
  const [hasCalendar, setHasCalendar] = useState(state.calendarConnected);
  const hoursSummary = useMemo(() => formatBusinessHoursSummary(state), [state]);

  useEffect(() => {
    void (async () => {
      try {
        const [calRes, intRes] = await Promise.all([
          fetch("/api/integrations/calendars"),
          fetch("/api/integrations/connections"),
        ]);
        const calJson = await calRes.json().catch(() => ({ data: [] }));
        const intJson = await intRes.json().catch(() => ({ data: {} }));
        const live = resolveLiveCalendar({
          voiceCalendars: (calJson.data || []) as Array<{
            status?: string;
            provider?: string;
            name?: string;
          }>,
          integrationConnections: (intJson.data?.connections || []) as Array<{
            provider?: string;
            status?: string;
            config?: Record<string, unknown> | null;
          }>,
        });
        setHasCalendar(live.connected);
        if (live.connected) {
          if (
            !state.calendarConnected ||
            state.calendarProvider !== live.provider ||
            state.calendarEmail !== live.name
          ) {
            patch({
              calendarConnected: true,
              calendarProvider: live.provider,
              calendarEmail: live.name,
            });
          }
        } else if (state.calendarConnected) {
          patch({ calendarConnected: false, calendarEmail: null });
        }
      } catch {
        // Keep existing state.calendarConnected if probes fail.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issues = getWizardActivationIssues(state, {
    hasCalendarConnection: hasCalendar,
  });
  const blocked = hasBlockingActivationIssues(issues);
  const readiness = buildWizardReadinessRows(state, { hasCalendarConnection: hasCalendar });

  const activateTitle = isMctb
    ? "Ready to turn on your voice agent?"
    : "Make your receptionist live";
  const activateDescription = isMctb
    ? "Review anything that still needs attention before the agent answers calls."
    : "Activate publishes your configuration. The next call routed to this number uses the updated agent — your phone forwarding decides when calls arrive.";

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        {isOpus ? (
          <Panel title={activateTitle} description={activateDescription} />
        ) : (
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">{activateTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{activateDescription}</p>
          </div>
        )}

        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{state.solutionName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            When a call reaches Transovo, this receptionist uses the configuration below — including
            business hours and on-call rules for how to handle the conversation (not when the line
            forwards).
          </p>
        </div>

        {issues.length ? (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Needs attention before activate</p>
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    issue.severity === "blocking" ? "text-destructive" : "text-warning"
                  }`}
                />
                <span>
                  <span className="font-medium text-foreground">
                    {issue.severity === "blocking" ? "Required: " : "Note: "}
                  </span>
                  {issue.message}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {readiness.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
            >
              <span className="font-medium">{item.label}</span>
              <StatusPill
                tone={
                  item.status === "ready"
                    ? "success"
                    : item.status === "needs_setup"
                      ? "warning"
                      : "muted"
                }
              >
                {item.status === "ready" ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : item.status === "needs_setup" ? (
                  <Clock className="h-3 w-3" />
                ) : null}
                {item.detail}
              </StatusPill>
            </div>
          ))}
        </div>
      </div>

      <SidePanel variant={uiVariant} title="Activate">
        <dl className="space-y-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Phone number</dt>
            <dd className="mt-0.5 font-medium text-foreground">{phone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Business hours (agent behavior)</dt>
            <dd className="mt-0.5 font-medium text-foreground">{hoursSummary}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">AI receptionist</dt>
            <dd className="mt-0.5 font-medium text-foreground">{state.agentName}</dd>
          </div>
        </dl>
        <Button
          type="button"
          data-testid="wizard-activate-submit"
          disabled={blocked}
          className="w-full"
          onClick={() => {
            patch({ activationMode: "activate_now", scheduledAt: null });
            void onActivate?.();
          }}
        >
          <Zap className="h-4 w-4" />
          Activate
        </Button>
        <Button
          type="button"
          variant="outline"
          className="mt-2 w-full"
          onClick={() => onGoToTest?.()}
        >
          <Play className="h-4 w-4" />
          Test in browser first
        </Button>
        <InfoCallout>
          Activate saves and publishes this wizard snapshot. On-call schedules, transfer rules, and
          after-hours behavior apply to calls after they reach the agent — they do not replace your
          carrier call-forwarding setup.
        </InfoCallout>
      </SidePanel>
    </div>
  );
}
