"use client";

import { DEFAULT_CONNECTION_GREETING } from "@/lib/solutions/appointment-receptionist/defaults";
import type {
  AppointmentReceptionistWizardState,
  ConnectionGreetingMode,
  NumberSource,
} from "@/lib/solutions/appointment-receptionist/types";
import { formatPhone } from "@/lib/utils";
import { CheckCircle2, Circle, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { InfoCallout, RadioRow, SelectableCard, SidePanel, StatusPill } from "../ui";

type PhoneRow = { id: string; e164: string; friendlyName: string | null; status: string };

const GREETING_OPTIONS: Array<{ id: ConnectionGreetingMode; label: string }> = [
  { id: "none", label: "No connection greeting" },
  { id: "transovo_professional", label: "Transovo professional greeting" },
  { id: "transovo_warm", label: "Transovo warm greeting" },
  { id: "upload_custom", label: "Upload custom greeting" },
  { id: "create_custom", label: "Create custom greeting" },
];

export function PhoneStep({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const [numbers, setNumbers] = useState<PhoneRow[]>([]);

  useEffect(() => {
    fetch("/api/phone/numbers")
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data || []) as PhoneRow[];
        setNumbers(rows);
        if (!state.phoneNumberId && rows[0]) {
          patch({
            phoneNumberId: rows[0].id,
            phoneNumberE164: rows[0].e164,
            numberSource: "existing",
          });
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = numbers.find((n) => n.id === state.phoneNumberId);
  const displayNumber = selected
    ? formatPhone(selected.e164)
    : state.phoneNumberE164
      ? formatPhone(state.phoneNumberE164)
      : "No number selected";

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Where should the receptionist answer?
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Phone number", ready: Boolean(state.phoneNumberId), optional: false },
              { label: "Inbound calling", ready: true, optional: false },
              { label: "AI Voice", ready: true, optional: false },
              { label: "Call recording", ready: state.callRecording !== "off", optional: true },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs"
              >
                {item.ready ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className={item.ready ? "text-success" : "text-muted-foreground"}>
                    {item.ready ? "Ready" : item.optional ? "Optional" : "Needed"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <SelectableCard
            selected={state.numberSource === "existing"}
            onClick={() => patch({ numberSource: "existing" as NumberSource })}
            title="Use existing Transovo number"
            description={
              numbers.length
                ? "Pick a number already in your workspace."
                : "No numbers yet — buy or port one first."
            }
          />
          <SelectableCard
            selected={state.numberSource === "buy_new"}
            onClick={() => patch({ numberSource: "buy_new" })}
            title="Buy a new number"
            description="Get a new local or toll-free number."
          />
          <SelectableCard
            selected={
              state.numberSource === "forward_existing" ||
              state.numberSource === "connect_existing"
            }
            onClick={() => patch({ numberSource: "forward_existing" })}
            title="Forward an existing business number"
            description="Keep your current number and route calls to Transovo."
          />
        </div>
        {state.numberSource === "existing" && numbers.length ? (
          <div className="mt-3 space-y-1.5">
            {numbers.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  patch({
                    phoneNumberId: n.id,
                    phoneNumberE164: n.e164,
                    numberSource: "existing",
                  });
                }}
                className={`block w-full max-w-md rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                  state.phoneNumberId === n.id
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border"
                }`}
              >
                {formatPhone(n.e164)}
                {n.friendlyName ? ` · ${n.friendlyName}` : ""}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Answering behavior</h3>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["ai_immediate", "Answer every incoming call"],
                  ["ring_team_first", "Ring team first then use AI"],
                  ["after_hours", "After-hours only"],
                  ["custom", "Custom schedule"],
                ] as const
              ).map(([id, label]) => (
                <RadioRow
                  key={id}
                  selected={state.ringBehavior === id}
                  onClick={() => patch({ ringBehavior: id })}
                  label={label}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Settings</h3>
            <label className="block text-xs text-muted-foreground">
              Ring team for
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={state.ringTeamSeconds}
                onChange={(e) => patch({ ringTeamSeconds: Number(e.target.value) })}
              >
                {[10, 15, 20, 30, 45].map((s) => (
                  <option key={s} value={s}>
                    {s} seconds
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Call recording
              <select
                className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                value={state.callRecording}
                onChange={(e) =>
                  patch({
                    callRecording: e.target.value as AppointmentReceptionistWizardState["callRecording"],
                  })
                }
              >
                <option value="all">Record all calls</option>
                <option value="inbound_only">Inbound only</option>
                <option value="off">Off</option>
              </select>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">While the receptionist connects</h3>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              {GREETING_OPTIONS.map((opt) => (
                <RadioRow
                  key={opt.id}
                  selected={state.connectionGreeting === opt.id}
                  onClick={() =>
                    patch({
                      connectionGreeting: opt.id,
                      connectionGreetingText:
                        opt.id === "none"
                          ? ""
                          : state.connectionGreetingText || DEFAULT_CONNECTION_GREETING,
                    })
                  }
                  label={opt.label}
                />
              ))}
            </div>
            {state.connectionGreeting !== "none" ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Play className="h-4 w-4 fill-current" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="h-8 rounded-md bg-gradient-to-r from-primary/20 via-primary/40 to-primary/10" />
                    <p className="mt-1 text-[11px] text-muted-foreground">0:00 / 0:06</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  “{state.connectionGreetingText || DEFAULT_CONNECTION_GREETING}”
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <SidePanel title="Phone setup">
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Selected number</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="font-medium">{displayNumber}</p>
              <StatusPill tone={state.phoneNumberId ? "success" : "warning"}>
                {state.phoneNumberId ? "Ready" : "Needed"}
              </StatusPill>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Call flow preview
            </p>
            <ol className="space-y-3 border-l border-border pl-3 text-xs">
              {[
                ["Inbound call", "Callers reach your number."],
                ["Connection greeting", "Greeting plays while AI initializes."],
                ["AI receptionist answers", "AI answers and assists the caller."],
                ["Books appointments", "Appointments scheduled on your calendar."],
                ["Confirmation", "Caller receives confirmation by text or email."],
              ].map(([t, d]) => (
                <li key={t}>
                  <p className="font-medium text-foreground">{t}</p>
                  <p className="text-muted-foreground">{d}</p>
                </li>
              ))}
            </ol>
          </div>
          <InfoCallout>
            Connection greeting plays while the AI initializes.
          </InfoCallout>
        </div>
      </SidePanel>
    </div>
  );
}
