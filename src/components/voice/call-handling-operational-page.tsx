"use client";

import { EmergencyTransferEditor } from "@/components/solutions/appointment-receptionist/emergency-transfer-editor";
import {
  AfterHoursBehaviorEditor,
  OnCallScheduleEditor,
} from "@/components/solutions/appointment-receptionist/operating-maturity-editor";
import { AfterHoursNotificationsEditor } from "@/components/solutions/appointment-receptionist/after-hours-notifications-editor";
import { UrgencyRulesEditor } from "@/components/solutions/appointment-receptionist/urgency-rules-editor";
import { SpamUnwantedCallsEditor } from "@/components/solutions/appointment-receptionist/spam-unwanted-calls-editor";
import { DependencyRow } from "@/components/voice/dependency-row";
import { formatBusinessHoursSummaryLine } from "@/lib/solutions/appointment-receptionist/knowledge-editor-schedule";
import { transferWizardValidationIssues } from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import { TransferEffectiveStatusCard } from "@/components/voice/transfer-effective-status-card";
import { TransferWaterfallPreview } from "@/components/voice/transfer-waterfall-preview";
import { VoiceIngressSetupPanel } from "@/components/voice/voice-ingress-setup-panel";
import { RecordingConfigCard } from "@/components/voice/recording-config-card";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "@/lib/solutions/appointment-receptionist/defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  afterHoursBehaviorSummary,
  buildCallHandlingBehaviorSummary,
} from "@/lib/voice/call-handling/behavior-summary";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TransovoProductPage } from "@/components/transovo/product-page";
import { TransovoPageLoading } from "@/components/transovo/state-feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toErrorMessage } from "@/lib/errors";

type RecentTransfer = {
  id: string;
  callId: string;
  createdAt: string;
  callerE164: string | null;
  destination: string;
  transferType: string;
  status: string;
  answered: boolean;
  transferMode: string | null;
};

function mctbBaseState(): AppointmentReceptionistWizardState {
  const base = applyWizardPreset(createDefaultWizardState(), "after_hours");
  return {
    ...base,
    solutionName: "After-Hours Voice Agent",
    role: "After-hours voice agent",
  };
}

export function CallHandlingOperationalPage() {
  const [state, setState] = useState<AppointmentReceptionistWizardState>(mctbBaseState);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [recentTransfers, setRecentTransfers] = useState<RecentTransfer[]>([]);

  const patch = useCallback((p: Partial<AppointmentReceptionistWizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const loadSetup = useCallback(async () => {
    setError("");
    try {
      let agentId: string | null = null;
      const agentsRes = await fetch("/api/voice/agents");
      if (agentsRes.ok) {
        const agentsJson = await agentsRes.json();
        const list = (agentsJson.data || []) as Array<{ id: string; status?: string }>;
        agentId = list[0]?.id ?? null;
      }
      const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
      const res = await fetch(`/api/solutions/appointment-receptionist${qs}`);
      if (!res.ok) throw new Error("Could not load agent configuration");
      const json = await res.json();
      const loaded = json?.data;
      if (loaded?.state) {
        setState({
          ...mctbBaseState(),
          ...loaded.state,
          agentId: loaded.agentId || loaded.state.agentId,
          setupId: loaded.setupId || undefined,
        });
      }
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setHydrated(true);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    try {
      const res = await fetch("/api/voice/call-handling/recent-transfers?limit=10");
      const json = await res.json();
      if (res.ok) setRecentTransfers(json.data || []);
    } catch {
      setRecentTransfers([]);
    }
  }, []);

  useEffect(() => {
    void loadSetup();
    void loadTransfers();
  }, [loadSetup, loadTransfers]);

  const summary = useMemo(() => buildCallHandlingBehaviorSummary(state), [state]);
  const hoursSummary = useMemo(() => afterHoursBehaviorSummary(state), [state]);
  const businessHoursLine = useMemo(() => formatBusinessHoursSummaryLine(state), [state]);
  const validationIssues = useMemo(() => transferWizardValidationIssues(state), [state]);

  async function save() {
    if (!state.agentId) {
      setError("Publish your AI agent in setup before saving call handling.");
      return;
    }
    if (validationIssues.length) {
      setError(validationIssues.map((i) => i.message).join(" "));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/solutions/appointment-receptionist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          wizardStepId: "call-handling",
          state,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSavedAt(new Date().toLocaleTimeString());
      if (json.data?.agentId) {
        setState((prev) => ({ ...prev, agentId: json.data.agentId }));
      }
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated) {
    return (
      <TransovoProductPage narrow>
        <TransovoPageLoading message="Loading call handling…" />
      </TransovoProductPage>
    );
  }

  return (
    <TransovoProductPage narrow className="pb-24">
      <PageHeader
        title="Call Handling"
        description="Manage transfers, on-call coverage, escalation, and caller protection — the same settings as your AI agent setup."
        className="!mb-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/voice/receptionist">Receptionist</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/voice/inbound-routing">Advanced routing</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/voice/calls?attention=open">Calls — needs attention</Link>
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {savedAt ? (
        <p className="text-xs text-muted-foreground">Saved at {savedAt}.</p>
      ) : null}

      <VoiceIngressSetupPanel wizardState={state} />

      <TransferEffectiveStatusCard state={state} patch={patch} />

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Current behavior</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          What happens on a real call with your saved configuration.
        </p>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <span className="text-muted-foreground">Transfers:</span>{" "}
            {summary.transfersEnabled ? "Enabled" : "Not configured"}
          </li>
          <li>
            <span className="text-muted-foreground">Routing:</span>{" "}
            {summary.routingMode === "waterfall" ? "Waterfall" : "Single destination"}
          </li>
          <li>
            <span className="text-muted-foreground">Primary destination:</span>{" "}
            {summary.primaryDestinationLabel ?? "—"}
          </li>
          <li>
            <span className="text-muted-foreground">Failed transfer:</span> {summary.fallbackLabel}
          </li>
          <li>
            <span className="text-muted-foreground">On-call schedule:</span>{" "}
            {summary.onCallEnabled ? "Enabled" : "Off"}
            {summary.onCallNowLabel
              ? ` · On call now: ${summary.onCallNowLabel}`
              : ""}
          </li>
          <li>
            <span className="text-muted-foreground">Urgent handling:</span>{" "}
            {summary.emergencyHandlingEnabled ? "Enabled" : "Off"}
          </li>
        </ul>
        <div className="mt-4">
          <TransferWaterfallPreview
            summary={summary}
            fallbackLabel={summary.fallbackLabel}
          />
        </div>
      </Card>

      <section className="space-y-4" aria-labelledby="transfers-heading">
        <h2 id="transfers-heading" className="text-lg font-semibold">Transfers</h2>
        <EmergencyTransferEditor state={state} patch={patch} />
      </section>

      <section className="space-y-4" aria-labelledby="hours-heading">
        <h2 id="hours-heading" className="text-lg font-semibold">Business hours &amp; after hours</h2>
        <p className="text-sm text-muted-foreground">{hoursSummary.duringHours}</p>
        <p className="text-sm text-muted-foreground">{hoursSummary.afterHours}</p>
        <div className="rounded-xl border border-border bg-card px-5">
          <DependencyRow
            title="Business hours"
            detail={`${businessHoursLine}. Used to determine when after-hours rules apply.`}
            href="/voice/knowledge#hours"
            linkLabel="Manage business hours"
          />
        </div>
        <AfterHoursBehaviorEditor state={state} patch={patch} />
      </section>

      <section className="space-y-4" aria-labelledby="oncall-heading">
        <h2 id="oncall-heading" className="text-lg font-semibold">On-call</h2>
        <OnCallScheduleEditor state={state} patch={patch} />
      </section>

      <section className="space-y-4" aria-labelledby="urgent-heading">
        <h2 id="urgent-heading" className="text-lg font-semibold">Emergency &amp; urgent calls</h2>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={state.urgencyEnabled === true}
            onChange={(e) => patch({ urgencyEnabled: e.target.checked })}
          />
          <span>
            <span className="font-medium">Urgent-call handling</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Escalate when collected fields match your urgency rules.
            </span>
          </span>
        </label>
        {state.urgencyEnabled ? <UrgencyRulesEditor state={state} patch={patch} /> : null}
      </section>

      <section className="space-y-4" aria-labelledby="notify-heading">
        <h2 id="notify-heading" className="text-lg font-semibold">Transfer notifications</h2>
        <AfterHoursNotificationsEditor state={state} patch={patch} />
      </section>

      <section aria-labelledby="spam-heading">
        <h2 id="spam-heading" className="mb-4 text-lg font-semibold">Caller protection</h2>
        <SpamUnwantedCallsEditor state={state} patch={patch} />
      </section>

      <section aria-labelledby="recording-heading">
        <h2 id="recording-heading" className="mb-4 text-lg font-semibold">Call recording</h2>
        <RecordingConfigCard state={state} patch={patch} />
      </section>

      <section className="space-y-3" aria-labelledby="recent-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="recent-heading" className="text-lg font-semibold">Recent transfers</h2>
          <Button variant="ghost" size="sm" type="button" onClick={() => void loadTransfers()}>
            Refresh
          </Button>
        </div>
        {recentTransfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transfer attempts in the last 14 days.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <THead>
                <TR>
                  <TH scope="col">When</TH>
                  <TH scope="col">Caller</TH>
                  <TH scope="col">Destination</TH>
                  <TH scope="col">Mode</TH>
                  <TH scope="col">Result</TH>
                  <TH scope="col">Call</TH>
                </TR>
              </THead>
              <TBody>
                {recentTransfers.map((t) => (
                  <TR key={t.id}>
                    <TD>{new Date(t.createdAt).toLocaleString()}</TD>
                    <TD>{t.callerE164 ?? "—"}</TD>
                    <TD>{t.destination}</TD>
                    <TD>{t.transferMode ?? t.transferType}</TD>
                    <TD>
                      {t.answered && t.status === "completed"
                        ? "Connected"
                        : t.status === "failed" || t.status === "exhausted"
                          ? "Did not connect"
                          : t.status}
                    </TD>
                    <TD>
                      <Link href={`/voice/calls/${t.callId}`} className="text-primary underline">
                        View
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Changes use the same configuration as AI agent setup.
          </p>
          <Button type="button" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </TransovoProductPage>
  );
}
