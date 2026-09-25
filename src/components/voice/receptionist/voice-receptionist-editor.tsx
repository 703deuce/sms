"use client";

import { TestStep } from "@/components/solutions/appointment-receptionist/steps/test-step";
import { GoalsStep } from "@/components/solutions/appointment-receptionist/steps/goals-step";
import { VoiceStep } from "@/components/solutions/appointment-receptionist/steps/voice-step";
import { CallbackRequiredFieldsEditor } from "@/components/solutions/appointment-receptionist/callback-required-fields-editor";
import { defaultCallbackRequiredCollectFieldIds } from "@/lib/solutions/appointment-receptionist/callback-required-field-defaults";
import { StatusPill } from "@/components/solutions/appointment-receptionist/ui";
import {
  applyWizardPreset,
  createDefaultWizardState,
} from "@/lib/solutions/appointment-receptionist/defaults";
import { resolveLiveCalendar } from "@/lib/solutions/appointment-receptionist/live-calendar";
import {
  computeDirtyGroups,
  type ReceptionistOwnershipGroup,
} from "@/lib/solutions/appointment-receptionist/receptionist-editor-ownership";
import {
  persistReceptionistActivate,
  persistReceptionistDraftGroups,
} from "@/lib/solutions/appointment-receptionist/receptionist-editor-persist";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";
import { transferWizardValidationIssues } from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { toErrorMessage } from "@/lib/errors";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReceptionistCollectFieldsEditor } from "./receptionist-collect-fields-editor";
import { ReceptionistBookingHandlingSection } from "./receptionist-booking-handling-section";

const SECTIONS = [
  { id: "identity-voice", label: "Identity & Voice" },
  { id: "greeting-conversation", label: "Greeting & Conversation" },
  { id: "responsibilities", label: "Responsibilities" },
  { id: "caller-information", label: "Caller Information" },
  { id: "appointment-handling", label: "Appointment Handling" },
  { id: "messages-callbacks", label: "Messages & Callbacks" },
] as const;

function baseState(): AppointmentReceptionistWizardState {
  const base = applyWizardPreset(createDefaultWizardState(), "after_hours");
  return {
    ...base,
    solutionName: "AI Receptionist",
    role: "Front-desk receptionist",
  };
}

function formatHoursSummary(state: AppointmentReceptionistWizardState): string {
  const m = ensureWizardOperatingMaturity(state);
  const tz = m.businessSchedule.timezone || "America/New_York";
  const openDays = (
    ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const
  ).filter((day) => {
    const row = m.businessSchedule.weekly[day];
    return row && !row.closed && row.ranges?.length;
  });
  if (!openDays.length) return `Hours not set (${tz})`;
  const first = m.businessSchedule.weekly[openDays[0]!]?.ranges?.[0];
  const range =
    first?.start && first?.end ? `${first.start} – ${first.end}` : "see Business Knowledge";
  const label =
    openDays.length === 5 &&
    !openDays.includes("saturday") &&
    !openDays.includes("sunday")
      ? "Mon – Fri"
      : `${openDays.length} days/week`;
  return `${label}, ${range} (${tz})`;
}

export function VoiceReceptionistEditor() {
  const [state, setState] = useState<AppointmentReceptionistWizardState>(baseState);
  const [baseline, setBaseline] = useState<AppointmentReceptionistWizardState>(baseState);
  const [agentStatus, setAgentStatus] = useState<string>("DRAFT");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [pendingPublication, setPendingPublication] = useState(false);
  const [calendarSummary, setCalendarSummary] = useState({
    connected: false,
    label: "Not connected",
  });
  const [showTestPanel, setShowTestPanel] = useState(false);

  const dirtyGroups = useMemo(
    () => computeDirtyGroups(state, baseline),
    [state, baseline],
  );
  const hasLocalEdits = dirtyGroups.size > 0;
  const isLive = agentStatus === "ACTIVE";

  const patch = useCallback((p: Partial<AppointmentReceptionistWizardState>) => {
    setState((prev) => ({ ...prev, ...p }));
    setStatusMessage("");
  }, []);

  const loadCalendarSummary = useCallback(async () => {
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
        }>,
      });
      setCalendarSummary({
        connected: live.connected,
        label: live.connected ? live.name || "Connected" : "Not connected",
      });
    } catch {
      setCalendarSummary({ connected: false, label: "Could not load calendar status" });
    }
  }, []);

  const loadSetup = useCallback(async () => {
    setError("");
    try {
      let agentId: string | null = null;
      const agentsRes = await fetch("/api/voice/agents");
      if (agentsRes.ok) {
        const agentsJson = await agentsRes.json();
        const list = (agentsJson.data || []) as Array<{ id: string }>;
        agentId = list[0]?.id ?? null;
      }
      const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
      const res = await fetch(`/api/solutions/appointment-receptionist${qs}`);
      if (!res.ok) throw new Error("Could not load receptionist configuration");
      const json = await res.json();
      const loaded = json?.data;
      if (loaded?.state) {
        const merged = {
          ...baseState(),
          ...loaded.state,
          agentId: loaded.agentId || loaded.state.agentId,
        } as AppointmentReceptionistWizardState;
        setState(merged);
        setBaseline(merged);
        setAgentStatus(loaded.status || "DRAFT");
        setPendingPublication(false);
      }
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setHydrated(true);
    }
    void loadCalendarSummary();
  }, [loadCalendarSummary]);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  async function saveDraftGroups(
    groups?: Set<ReceptionistOwnershipGroup>,
  ): Promise<{ ok: boolean; agentId?: string }> {
    const toSave = groups ?? dirtyGroups;
    if (!toSave.size) {
      setStatusMessage("No changes to save.");
      return { ok: true, agentId: state.agentId };
    }
    let workingState = state;
    if (!workingState.agentId) {
      const createRes = await fetch("/api/solutions/appointment-receptionist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create_draft",
          state: workingState,
          wizardStepId: "goals",
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) {
        setError(createJson.error || "Could not create draft agent");
        return { ok: false };
      }
      const id = createJson.data?.agentId as string;
      if (id) {
        workingState = { ...workingState, agentId: id };
        setState(workingState);
        setBaseline((b) => ({ ...b, agentId: id }));
      }
    }

    setBusy(true);
    setError("");
    const result = await persistReceptionistDraftGroups({
      state: workingState,
      dirtyGroups: [...toSave],
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error || "Save failed");
      if (result.savedGroups.length) {
        setStatusMessage(
          `Saved ${result.savedGroups.join(", ")}. Failed on ${result.failedGroups.join(", ")}.`,
        );
      }
      return { ok: false, agentId: result.agentId };
    }

    if (result.agentId) {
      setState((s) => ({ ...s, agentId: result.agentId }));
    }
    const nextBaseline = {
      ...workingState,
      agentId: result.agentId || workingState.agentId,
    };
    setState(nextBaseline);
    setBaseline(nextBaseline);
    if (isLive) setPendingPublication(true);
    setStatusMessage(
      isLive
        ? "Changes saved to draft. Publish to update live calls."
        : "Draft saved.",
    );
    if (result.warnings.length) {
      setError(result.warnings.join(" "));
    }
    return {
      ok: true,
      agentId: result.agentId || nextBaseline.agentId,
    };
  }

  async function ensureAgentForTest() {
    const groups =
      dirtyGroups.size > 0
        ? dirtyGroups
        : new Set<ReceptionistOwnershipGroup>(["goals"]);
    const saved = await saveDraftGroups(groups);
    if (!saved.ok || !saved.agentId) return null;
    return { agentId: saved.agentId };
  }

  async function publish() {
    if (hasLocalEdits) {
      const saved = await saveDraftGroups(dirtyGroups);
      if (!saved.ok) return;
    }
    setBusy(true);
    setError("");
    const result = await persistReceptionistActivate(state);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Publish failed");
      return;
    }
    setAgentStatus("ACTIVE");
    setPendingPublication(false);
    setBaseline(state);
    setStatusMessage("Published — live for callers.");
    if (result.warnings.length) setError(result.warnings.join(" "));
  }

  const headerStatus = useMemo(() => {
    if (!state.agentId) return { tone: "muted" as const, label: "Setup required" };
    if (hasLocalEdits) return { tone: "warning" as const, label: "Unsaved changes" };
    if (isLive && pendingPublication)
      return { tone: "warning" as const, label: "Draft saved — publish to go live" };
    if (isLive) return { tone: "success" as const, label: "Live" };
    return { tone: "muted" as const, label: "Draft" };
  }, [state.agentId, hasLocalEdits, isLive, pendingPublication]);

  const transferIssues = useMemo(() => transferWizardValidationIssues(state), [state]);
  const hoursSummary = useMemo(() => formatHoursSummary(state), [state]);

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Loading receptionist…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-24 px-4 sm:px-8">
      <PageHeader
        title="Receptionist"
        description="Configure how your AI receptionist speaks, collects information, and helps callers."
        actions={
          <>
            <StatusPill tone={headerStatus.tone}>{headerStatus.label}</StatusPill>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTestPanel((v) => !v)}
            >
              Test receptionist
            </Button>
            {isLive && !hasLocalEdits && !pendingPublication ? null : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={busy || (!hasLocalEdits && isLive && !pendingPublication)}
                onClick={() => void publish()}
              >
                {busy ? "Publishing…" : state.agentId && isLive ? "Publish changes" : "Go live"}
              </Button>
            )}
          </>
        }
      />

      <div aria-live="polite" className="min-h-[1.25rem] text-sm text-muted-foreground">
        {statusMessage}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLive && (pendingPublication || hasLocalEdits) ? (
        <p className="text-xs text-muted-foreground">
          Live callers use your published configuration until you publish saved changes.
        </p>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row">
        <nav
          className="hidden shrink-0 lg:block lg:w-48"
          aria-label="Receptionist sections"
        >
          <ul className="sticky top-4 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-wrap gap-1 lg:hidden">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-border px-2.5 py-1 text-xs font-medium"
            >
              {s.label}
            </a>
          ))}
        </div>

        <div className="min-w-0 flex-1 space-y-8">
          <section
            id="identity-voice"
            className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-sm font-semibold">Identity &amp; voice</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Name, role, and how Amy sounds on the phone.
            </p>
            <div className="mt-4">
              <VoiceStep
                state={state}
                patch={patch}
                parts={["identity", "voice"]}
                showSidePanel={false}
              />
            </div>
          </section>

          <section
            id="greeting-conversation"
            className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-sm font-semibold">Greeting &amp; conversation</h2>
            <div className="mt-4">
              <VoiceStep
                state={state}
                patch={patch}
                parts={["greeting"]}
                showSidePanel={false}
              />
            </div>
          </section>

          <section
            id="responsibilities"
            className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-sm font-semibold">Responsibilities</h2>
            <GoalsStep
              state={state}
              patch={patch}
              compactCapabilities
              hideSidePanel
              hideSolutionName
            />
            <div className="mt-6 divide-y divide-border border-t border-border pt-4">
              <DependencyRow
                title="Business hours"
                detail={hoursSummary}
                href="/voice/knowledge"
                linkLabel="Manage business hours"
              />
              <DependencyRow
                title="Business knowledge"
                detail={
                  state.knowledgeBaseEnabled
                    ? "Knowledge base linked"
                    : "Answer questions may need knowledge sources"
                }
                href="/voice/knowledge"
                linkLabel="Manage business knowledge"
              />
              <DependencyRow
                title="Transfer calls"
                detail={
                  state.capabilities.includes("transfer_calls")
                    ? transferIssues.length
                      ? "Needs call handling setup"
                      : "Configured"
                    : "Off"
                }
                href="/voice/call-handling"
                linkLabel="Manage call handling"
              />
            </div>
          </section>

          <section
            id="caller-information"
            className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-sm font-semibold">Caller information</h2>
            <div className="mt-4">
              <ReceptionistCollectFieldsEditor state={state} patch={patch} />
            </div>
          </section>

          <section
            id="appointment-handling"
            className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-sm font-semibold">Appointment handling</h2>
            <div className="mt-4">
              <ReceptionistBookingHandlingSection
                state={state}
                patch={patch}
                calendarSummary={calendarSummary}
              />
            </div>
          </section>

          <section
            id="messages-callbacks"
            className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="text-sm font-semibold">Messages &amp; callbacks</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              What Amy may collect on the call. Operational notifications live in Call Handling.
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={state.callbackRequestsEnabled !== false}
                  onChange={(e) => {
                    const on = e.target.checked;
                    if (on && !state.callbackRequiredCollectFieldIds?.length) {
                      patch({
                        callbackRequestsEnabled: true,
                        callbackRequiredCollectFieldIds: defaultCallbackRequiredCollectFieldIds(
                          state.collectFields,
                        ),
                      });
                    } else {
                      patch({ callbackRequestsEnabled: on });
                    }
                  }}
                />
                <span className="font-medium">Take messages and callback requests</span>
              </label>
              {state.callbackRequestsEnabled !== false ? (
                <CallbackRequiredFieldsEditor state={state} patch={patch} />
              ) : null}
              <DependencyRow
                title="After-hours notifications"
                detail="Who gets alerted after important outcomes"
                href="/voice/call-handling"
                linkLabel="Manage in call handling"
              />
            </div>
          </section>

          {showTestPanel ? (
            <section id="test" className="scroll-mt-24 rounded-xl border border-border bg-card p-5">
              <TestStep state={state} patch={patch} onEnsureAgent={ensureAgentForTest} />
            </section>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {hasLocalEdits
              ? "You have unsaved changes."
              : isLive && pendingPublication
                ? "Draft saved — publish to update live calls."
                : isLive
                  ? "Live configuration is active."
                  : "Save a draft before testing or going live."}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !hasLocalEdits}
              onClick={() => void saveDraftGroups()}
            >
              {busy ? "Saving…" : "Save draft"}
            </Button>
            {(hasLocalEdits || pendingPublication || !isLive) && (
              <Button type="button" disabled={busy} onClick={() => void publish()}>
                {busy ? "Working…" : isLive ? "Publish changes" : "Go live"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DependencyRow({
  title,
  detail,
  href,
  linkLabel,
}: {
  title: string;
  detail: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 max-w-xl">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      <Link href={href} className="shrink-0 text-sm font-medium text-primary hover:underline">
        {linkLabel} →
      </Link>
    </div>
  );
}
