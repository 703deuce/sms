"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
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
import { transferWizardValidationIssues } from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import {
  formatReceptionistHoursSummary,
  receptionistEditorBaseState,
} from "@/lib/voice/receptionist/receptionist-editor-shared";

export type ReceptionistHeaderStatus = {
  tone: "muted" | "warning" | "success";
  label: string;
};

export function useVoiceReceptionistEditor() {
  const [state, setState] = useState<AppointmentReceptionistWizardState>(receptionistEditorBaseState);
  const [baseline, setBaseline] = useState<AppointmentReceptionistWizardState>(receptionistEditorBaseState);
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

  const dirtyGroups = useMemo(() => computeDirtyGroups(state, baseline), [state, baseline]);
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
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      );
      const agentIdFromUrl = params.get("agentId");
      const setupIdFromUrl = params.get("setupId");
      const qs = new URLSearchParams();
      if (setupIdFromUrl) qs.set("setupId", setupIdFromUrl);
      if (agentIdFromUrl) qs.set("agentId", agentIdFromUrl);
      const res = await fetch(
        `/api/solutions/appointment-receptionist${qs.toString() ? `?${qs.toString()}` : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Could not load receptionist configuration");
      const json = await res.json();
      const loaded = json?.data;
      if (loaded?.state || loaded?.agentId) {
        const serverState =
          loaded.state && typeof loaded.state === "object" ? loaded.state : {};
        const { normalizeWizardBookingStrategy } = await import(
          "@/lib/solutions/appointment-receptionist/booking-strategy-ui"
        );
        const merged = normalizeWizardBookingStrategy({
          ...receptionistEditorBaseState(),
          ...serverState,
          agentId: loaded.agentId || serverState.agentId,
        } as AppointmentReceptionistWizardState);
        setState(merged);
        setBaseline(merged);
        setAgentStatus(loaded.status || "DRAFT");
        setPendingPublication(false);
        const health = String(loaded.healthStatus || "");
        if (health === "live_sync_pending" && loaded.healthMessage) {
          setError(String(loaded.healthMessage));
        }
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

  const saveDraftGroups = useCallback(
    async (groups?: Set<ReceptionistOwnershipGroup>): Promise<{ ok: boolean; agentId?: string }> => {
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
        isLive ? "Changes saved to draft. Publish to update live calls." : "Draft saved.",
      );
      if (result.warnings.length) {
        setError(result.warnings.join(" "));
      }
      return { ok: true, agentId: result.agentId || nextBaseline.agentId };
    },
    [dirtyGroups, isLive, state],
  );

  const ensureAgentForTest = useCallback(async () => {
    const groups =
      dirtyGroups.size > 0 ? dirtyGroups : new Set<ReceptionistOwnershipGroup>(["goals"]);
    const saved = await saveDraftGroups(groups);
    if (!saved.ok || !saved.agentId) return null;
    return { agentId: saved.agentId };
  }, [dirtyGroups, saveDraftGroups]);

  const publish = useCallback(async () => {
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
  }, [dirtyGroups, hasLocalEdits, saveDraftGroups, state]);

  const headerStatus: ReceptionistHeaderStatus = useMemo(() => {
    if (!state.agentId) return { tone: "muted", label: "Setup required" };
    if (hasLocalEdits) return { tone: "warning", label: "Unsaved changes" };
    if (isLive && pendingPublication)
      return { tone: "warning", label: "Draft saved — publish to go live" };
    if (isLive) return { tone: "success", label: "Live" };
    if (state.agentId && !hasLocalEdits) return { tone: "muted", label: "Ready to publish" };
    return { tone: "muted", label: "Draft" };
  }, [state.agentId, hasLocalEdits, isLive, pendingPublication]);

  const transferIssues = useMemo(() => transferWizardValidationIssues(state), [state]);
  const hoursSummary = useMemo(() => formatReceptionistHoursSummary(state), [state]);

  return {
    state,
    patch,
    hydrated,
    busy,
    error,
    statusMessage,
    showTestPanel,
    setShowTestPanel,
    calendarSummary,
    headerStatus,
    hasLocalEdits,
    isLive,
    pendingPublication,
    transferIssues,
    hoursSummary,
    saveDraftGroups,
    ensureAgentForTest,
    publish,
  };
}
