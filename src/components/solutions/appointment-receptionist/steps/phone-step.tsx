"use client";

import { DEFAULT_CONNECTION_GREETING } from "@/lib/solutions/appointment-receptionist/defaults";
import { hasBookingCapability } from "@/lib/solutions/appointment-receptionist/wizard-presets";
import type {
  AppointmentReceptionistWizardState,
  ConnectionGreetingMode,
  NumberSource,
} from "@/lib/solutions/appointment-receptionist/types";
import { formatPhone } from "@/lib/utils";
import { CheckCircle2, Circle, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { InfoCallout, RadioRow, SelectableCard, SidePanel, StatusPill } from "../ui";

type PhoneRow = {
  id: string;
  e164: string;
  friendlyName: string | null;
  status: string;
  aiOwner?: { id: string; name: string; status: string } | null;
  hasSoftphoneAssignment?: boolean;
};

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
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: "legacy" | "mctb";
}) {
  const isMctb = presentation === "mctb";
  const [numbers, setNumbers] = useState<PhoneRow[]>([]);
  const [mctbLineReuse, setMctbLineReuse] = useState<{
    ingressE164: string;
    forwardingStatus: string;
    businessLineE164: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isMctb) return;
    fetch("/api/mctb/inbound-handling")
      .then((r) => r.json())
      .then((j) => {
        const fwd = j.data?.forwarding;
        const line = j.data?.line;
        if (!fwd?.ingressE164) return;
        setMctbLineReuse({
          ingressE164: fwd.ingressE164,
          forwardingStatus: fwd.status,
          businessLineE164: fwd.businessLineE164,
        });
        if (!state.phoneNumberId && line?.phoneNumberId) {
          patch({
            phoneNumberId: line.phoneNumberId,
            phoneNumberE164: line.ingressE164,
            numberSource: "forward_existing",
          });
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMctb]);

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
  const booking = hasBookingCapability(state.capabilities);
  const displayNumber = selected
    ? formatPhone(selected.e164)
    : state.phoneNumberE164
      ? formatPhone(state.phoneNumberE164)
      : "No number selected";
  const otherOwner =
    selected?.aiOwner && selected.aiOwner.id !== state.agentId
      ? selected.aiOwner
      : null;

  const previewSteps: Array<[string, string]> = [
    ["Inbound call", "Callers reach your number."],
    ["Connection greeting", "Greeting plays while AI initializes."],
    ["AI agent answers", "AI answers and assists the caller."],
  ];
  if (booking) {
    previewSteps.push(
      ["Books appointments", "Appointments scheduled on your calendar."],
      ["Confirmation", "Caller receives confirmation by text or email."],
    );
  } else {
    previewSteps.push(
      ["Take messages / transfer", "Capture details or hand off to a person."],
      ["End call", "Call outcome recorded for the workflow."],
    );
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {isMctb ? "Where should the agent answer?" : "Where should the receptionist answer?"}
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

        {isMctb && mctbLineReuse ? (
          <InfoCallout>
            <p className="font-medium">Your business line is already connected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {mctbLineReuse.businessLineE164
                ? `Calls from ${formatPhone(mctbLineReuse.businessLineE164)} forward to Transovo after no answer.`
                : "Calls forward to Transovo after no answer."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Transovo number {formatPhone(mctbLineReuse.ingressE164)} · Forwarding{" "}
              {mctbLineReuse.forwardingStatus === "connected" ? "already connected" : "pending"}
            </p>
          </InfoCallout>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          {isMctb && mctbLineReuse ? (
            <SelectableCard
              selected={
                state.phoneNumberId &&
                state.numberSource === "forward_existing"
              }
              onClick={() =>
                patch({
                  numberSource: "forward_existing",
                  phoneNumberId: state.phoneNumberId,
                  phoneNumberE164: mctbLineReuse.ingressE164,
                })
              }
              title="Use existing MCTB line"
              description="Recommended — same forwarding you already set up for missed-call recovery."
            />
          ) : null}
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
        {state.numberSource === "buy_new" ? (
          <div className="mt-3 max-w-md rounded-xl border border-primary/30 bg-card p-4 text-sm">
            <p className="font-medium">Buy a number in Numbers</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Open Numbers to purchase a DID, then return here and choose
              &quot;Use existing Transovo number.&quot;
            </p>
            <a
              href="/my-numbers"
              className="mt-3 inline-flex rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Open My Numbers
            </a>
          </div>
        ) : null}
        {state.numberSource === "forward_existing" ||
        state.numberSource === "connect_existing" ? (
          <div className="mt-3 max-w-lg space-y-2 rounded-xl border border-primary/30 bg-card p-4 text-sm">
            <p className="font-medium">Forward your carrier number to Transovo</p>
            <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Buy or pick a Transovo number below (or in My Numbers).</li>
              <li>
                In your carrier portal, set call forwarding to that Transovo
                number.
              </li>
              <li>
                Select the Transovo number here so Activate publishes AI routing.
              </li>
            </ol>
            {numbers.length ? (
              <div className="mt-2 space-y-1">
                {numbers.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() =>
                      patch({
                        phoneNumberId: n.id,
                        phoneNumberE164: n.e164,
                        numberSource: "forward_existing",
                      })
                    }
                    className={`block w-full rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                      state.phoneNumberId === n.id
                        ? "border-primary bg-primary/5 font-medium text-primary"
                        : "border-border"
                    }`}
                  >
                    Forward to {formatPhone(n.e164)}
                  </button>
                ))}
              </div>
            ) : (
              <a
                href="/my-numbers"
                className="mt-2 inline-flex text-xs font-medium text-primary underline"
              >
                Get a Transovo number first
              </a>
            )}
          </div>
        ) : null}
        {state.numberSource === "existing" && numbers.length ? (
          <div className="mt-3 space-y-1.5">
            {numbers.map((n) => {
              const ownedByOther =
                n.aiOwner && n.aiOwner.id !== state.agentId ? n.aiOwner : null;
              return (
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
                  <span className="block">
                    {formatPhone(n.e164)}
                    {n.friendlyName ? ` · ${n.friendlyName}` : ""}
                  </span>
                  {ownedByOther ? (
                    <span className="mt-0.5 block font-normal text-muted-foreground">
                      Currently answered by {ownedByOther.name}
                      {ownedByOther.status === "ACTIVE" ? " (live)" : ""} — activate to switch
                    </span>
                  ) : n.aiOwner?.id === state.agentId ? (
                    <span className="mt-0.5 block font-normal text-muted-foreground">
                      Already assigned to this receptionist
                    </span>
                  ) : (
                    <span className="mt-0.5 block font-normal text-muted-foreground">
                      Available — activate to put this receptionist on the line
                    </span>
                  )}
                </button>
              );
            })}
            {otherOwner ? (
              <InfoCallout>
                Selecting this number switches inbound calls from{" "}
                <strong>{otherOwner.name}</strong> to this appointment receptionist when you
                activate. Only one AI agent answers a number at a time.
              </InfoCallout>
            ) : null}
            {selected?.hasSoftphoneAssignment ? (
              <InfoCallout>
                This number also has a softphone / team assignment. After you activate,
                the AI receptionist owns inbound calls; remove the softphone assignment
                in Numbers if you want humans to answer this DID instead.
              </InfoCallout>
            ) : null}
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
                  ["line_busy", "When the line is busy"],
                  ["custom", "Custom schedule"],
                ] as const
              ).map(([id, label]) => (
                <RadioRow
                  key={id}
                  selected={state.ringBehavior === id}
                  onClick={() =>
                    patch({
                      ringBehavior: id,
                      answerWhen:
                        id === "ring_team_first"
                          ? "nobody_answers"
                          : id === "after_hours"
                            ? "after_hours"
                            : id === "custom"
                              ? "custom_schedule"
                              : id === "line_busy"
                                ? "line_busy"
                                : "every_call",
                    })
                  }
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
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    aria-label="Preview greeting"
                    onClick={() => {
                      const text =
                        state.connectionGreetingText ||
                        DEFAULT_CONNECTION_GREETING;
                      if (typeof window !== "undefined" && window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                        const u = new SpeechSynthesisUtterance(text);
                        window.speechSynthesis.speak(u);
                      }
                    }}
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">Preview connection greeting</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {state.connectionGreetingText || DEFAULT_CONNECTION_GREETING}
                    </p>
                  </div>
                </div>
                {state.connectionGreeting === "upload_custom" ? (
                  <label className="mt-3 block text-xs text-muted-foreground">
                    Greeting audio URL (HTTPS MP3/WAV)
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                      type="url"
                      placeholder="https://…"
                      value={state.connectionGreetingAudioUrl || ""}
                      onChange={(e) =>
                        patch({ connectionGreetingAudioUrl: e.target.value })
                      }
                    />
                  </label>
                ) : null}
                {state.connectionGreeting === "create_custom" ||
                state.connectionGreeting === "transovo_professional" ||
                state.connectionGreeting === "transovo_warm" ? (
                  <label className="mt-3 block text-xs text-muted-foreground">
                    {state.connectionGreeting === "create_custom"
                      ? "Custom greeting text"
                      : "Greeting text"}
                    <textarea
                      className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                      rows={3}
                      value={state.connectionGreetingText || ""}
                      onChange={(e) =>
                        patch({ connectionGreetingText: e.target.value })
                      }
                    />
                  </label>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    “{state.connectionGreetingText || DEFAULT_CONNECTION_GREETING}”
                  </p>
                )}
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
              {previewSteps.map(([t, d]) => (
                <li key={t}>
                  <p className="font-medium text-foreground">{t}</p>
                  <p className="text-muted-foreground">{d}</p>
                </li>
              ))}
            </ol>
          </div>
          <InfoCallout>
            Activate publishes this agent to Telnyx and assigns your selected number so
            inbound callers reach this receptionist. Connection greeting plays while the AI
            initializes.
          </InfoCallout>
        </div>
      </SidePanel>
    </div>
  );
}
