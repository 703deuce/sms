"use client";

import {
  answerWhenOptionsForPreset,
  capabilityOptionsForPreset,
  goalsSidePanelCopy,
  AMY_FIXED_CAPABILITIES,
} from "@/lib/solutions/appointment-receptionist/wizard-presets";
import type {
  AnswerWhen,
  AppointmentReceptionistWizardState,
  CapabilityId,
} from "@/lib/solutions/appointment-receptionist/types";
import {
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Mail,
  MessageCircle,
  MessageSquare,
  PhoneForwarded,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useEffect } from "react";
import { InfoCallout, RadioRow, SelectableCard, SidePanel } from "../ui";
import { Input, Label } from "@/components/ui/input";

const ICONS = {
  MessageCircle,
  CalendarPlus,
  CalendarClock,
  CalendarX,
  Mail,
  UserCheck,
  PhoneForwarded,
  MessageSquare,
} as const;

const OPERATING_MODES: Array<{
  id: AnswerWhen;
  label: string;
  description: string;
}> = [
  {
    id: "every_call",
    label: "Main receptionist",
    description: "Amy answers every call on her assigned number.",
  },
  {
    id: "nobody_answers",
    label: "Overflow receptionist",
    description: "Ring your team first; Amy picks up when nobody answers.",
  },
  {
    id: "after_hours",
    label: "After-hours receptionist",
    description: "Amy covers nights, weekends, and holidays.",
  },
];

export function GoalsStep({
  state,
  patch,
  hireMode = false,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  hireMode?: boolean;
  presentation?: "legacy" | "mctb";
}) {
  const isMctb = presentation === "mctb";
  const options = capabilityOptionsForPreset(state.preset);
  const answerOptions = answerWhenOptionsForPreset(state.preset);
  const panel = goalsSidePanelCopy(state.preset);

  useEffect(() => {
    if (!hireMode) return;
    // Lock Amy's job — never ask the customer to redefine booking.
    const locked = new Set<CapabilityId>([
      ...AMY_FIXED_CAPABILITIES,
      ...(state.capabilities.includes("reschedule") ? (["reschedule"] as const) : []),
      ...(state.capabilities.includes("cancel") ? (["cancel"] as const) : []),
    ]);
    const next = [...locked];
    const same =
      next.length === state.capabilities.length &&
      next.every((c) => state.capabilities.includes(c));
    if (!same) {
      patch({
        capabilities: next,
        agentName: state.agentName || "Amy",
        solutionName:
          state.solutionName?.includes("Appointment") || !state.solutionName
            ? "Amy — Appointment Booking Agent"
            : state.solutionName,
        role: "Appointment booking agent",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hireMode]);

  function toggleCap(id: CapabilityId) {
    if (hireMode && (id === "book_appointments" || id === "answer_questions")) {
      return;
    }
    const has = state.capabilities.includes(id);
    const next = has
      ? state.capabilities.filter((c) => c !== id)
      : [...state.capabilities, id];
    const allowed = new Set(options.map((o) => o.id));
    patch({
      capabilities: next.filter((c) => allowed.has(c)),
    });
  }

  if (hireMode) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-8">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-800">
              Fixed by agent type
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">
              Amy books appointments over the phone
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              You are not building her profession. You are assigning this Amy to your business —
              number, calendar, services, and rules.
            </p>
            <ul className="mt-3 grid gap-1 text-[12px] text-slate-600 sm:grid-cols-2">
              {[
                "Checks real availability",
                "Offers valid times",
                "Confirms details before booking",
                "Creates and verifies appointments",
                "Sends confirmations when enabled",
                "Falls back when booking fails",
              ].map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

          <div>
            <Label htmlFor="solution-name">What should we call this Amy?</Label>
            <Input
              id="solution-name"
              className="mt-1.5 max-w-lg"
              value={state.solutionName}
              onChange={(e) => {
                const solutionName = e.target.value;
                patch({
                  solutionName,
                  agentName:
                    !state.agentName ||
                    state.agentName === "Amy" ||
                    state.agentName === state.solutionName
                      ? solutionName.split("—")[0].trim().slice(0, 40) || "Amy"
                      : state.agentName,
                });
              }}
              placeholder="Amy — Fredericksburg Main Office"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Dashboard name can differ from the name spoken to callers (set in Voice).
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">
              How should Amy cover the phone?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Booking is always on. Choose only the coverage mode for this instance.
            </p>
            <div className="mt-3 grid gap-2">
              {OPERATING_MODES.map((opt) => (
                <RadioRow
                  key={opt.id}
                  selected={state.answerWhen === opt.id}
                  onClick={() => {
                    const answerWhen = opt.id;
                    const ringBehavior =
                      answerWhen === "nobody_answers"
                        ? "ring_team_first"
                        : answerWhen === "after_hours"
                          ? "after_hours"
                          : "ai_immediate";
                    patch({ answerWhen, ringBehavior });
                  }}
                  label={opt.label}
                  description={opt.description}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Optional permissions</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Reschedule and cancel are off by default — enable only if you want Amy to do them.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["reschedule", "May reschedule"],
                  ["cancel", "May cancel"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleCap(id)}
                  className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${
                    state.capabilities.includes(id)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SidePanel title="What you will configure next">
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>• Phone number and routing</li>
            <li>• Calendar and bookable services</li>
            <li>• What Amy must collect from callers</li>
            <li>• Notice, cutoffs, and transfer rules</li>
            <li>• Voice, test, then put Amy to work</li>
          </ul>
          <InfoCallout>
            Company Brain facts were collected first. Amy retrieves approved company knowledge
            plus her appointment-specific rules.
          </InfoCallout>
        </SidePanel>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <Label htmlFor="solution-name">Agent name</Label>
          <Input
            id="solution-name"
            className="mt-1.5 max-w-lg"
            value={state.solutionName}
            onChange={(e) => {
              const solutionName = e.target.value;
              patch({
                solutionName,
                agentName:
                  !state.agentName ||
                  state.agentName === "Astra" ||
                  state.agentName === state.solutionName
                    ? solutionName.slice(0, 40) || state.agentName
                    : state.agentName,
              });
            }}
            placeholder="e.g. Front Desk — Main Office"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            This name shows in Your Team and Automations so you can tell agents apart.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {isMctb ? "What should your voice agent handle?" : "What should this agent do?"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMctb
              ? "Choose what the agent is allowed to help callers with."
              : "Options match this agent type — select all that apply."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {options.map((opt) => {
              const Icon = ICONS[opt.icon as keyof typeof ICONS];
              return (
                <SelectableCard
                  key={opt.id}
                  selected={state.capabilities.includes(opt.id)}
                  onClick={() => toggleCap(opt.id)}
                  title={opt.title}
                  description={opt.description}
                  icon={<Icon className="h-4 w-4" />}
                />
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">
            When should this agent answer?
          </h3>
          <div className="mt-3 grid gap-2">
            {answerOptions.map((opt) => (
              <RadioRow
                key={opt.id}
                selected={state.answerWhen === opt.id}
                onClick={() => {
                  const answerWhen = opt.id as AnswerWhen;
                  const ringBehavior =
                    answerWhen === "nobody_answers"
                      ? "ring_team_first"
                      : answerWhen === "after_hours"
                        ? "after_hours"
                        : answerWhen === "custom_schedule"
                          ? "custom"
                          : answerWhen === "line_busy"
                            ? "line_busy"
                            : "ai_immediate";
                  patch({ answerWhen, ringBehavior });
                }}
                label={opt.label}
                description={opt.description}
              />
            ))}
          </div>
        </div>
      </div>

      <SidePanel title={isMctb ? "Agent summary" : "Recommended setup"}>
        {isMctb ? (
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Purpose:</span> After-hours call
              recovery
            </li>
            <li>
              <span className="font-semibold text-foreground">Enabled capabilities:</span>{" "}
              {state.capabilities.length}
            </li>
            <li>
              <span className="font-semibold text-foreground">Policy source:</span> AI Lead
              Recovery
            </li>
            <li>
              <span className="font-semibold text-foreground">Booking:</span>{" "}
              {state.capabilities.includes("book_appointments") ? "Available" : "Off"}
            </li>
            <li>
              <span className="font-semibold text-foreground">Transfer:</span>{" "}
              {state.capabilities.includes("transfer_calls")
                ? state.transferDestinationPhone?.trim()
                  ? "Ready"
                  : "Needs setup"
                : "Off"}
            </li>
          </ul>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Outcome
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{panel.outcome}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Required products
              </p>
              <ul className="mt-2 space-y-2 text-xs">
                {panel.required.map((r) => (
                  <li key={r.label} className="flex gap-2">
                    <span className={`mt-0.5 h-2 w-2 rounded-full ${r.tone}`} />
                    <span>
                      <strong>{r.label}</strong> — {r.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Optional products
              </p>
              <ul className="mt-2 space-y-2 text-xs">
                {panel.optional.map((o) => (
                  <li key={o} className="flex gap-2">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-muted-foreground/40" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
            <InfoCallout>
              After you continue, we&apos;ll generate your visual workflow for this agent.
            </InfoCallout>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
