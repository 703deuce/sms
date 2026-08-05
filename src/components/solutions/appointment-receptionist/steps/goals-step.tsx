"use client";

import {
  ANSWER_WHEN_OPTIONS,
} from "@/lib/solutions/appointment-receptionist/defaults";
import {
  capabilityOptionsForPreset,
  goalsSidePanelCopy,
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

export function GoalsStep({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const options = capabilityOptionsForPreset(state.preset);
  const panel = goalsSidePanelCopy(state.preset);

  function toggleCap(id: CapabilityId) {
    const has = state.capabilities.includes(id);
    const next = has
      ? state.capabilities.filter((c) => c !== id)
      : [...state.capabilities, id];
    // Keep only options allowed for this agent type.
    const allowed = new Set(options.map((o) => o.id));
    patch({
      capabilities: next.filter((c) => allowed.has(c)),
    });
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
            onChange={(e) => patch({ solutionName: e.target.value })}
            placeholder="e.g. Front Desk — Main Office"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            This name shows in My Agents and Automations so you can tell agents apart.
          </p>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            What should this agent do?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Options match this agent type — select all that apply.
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
            {ANSWER_WHEN_OPTIONS.map((opt) => (
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

      <SidePanel title="Recommended setup">
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Outcome
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {panel.outcome}
            </p>
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
      </SidePanel>
    </div>
  );
}
