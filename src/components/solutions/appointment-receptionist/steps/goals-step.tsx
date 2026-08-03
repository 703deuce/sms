"use client";

import {
  ANSWER_WHEN_OPTIONS,
  CAPABILITY_OPTIONS,
} from "@/lib/solutions/appointment-receptionist/defaults";
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
  function toggleCap(id: CapabilityId) {
    const has = state.capabilities.includes(id);
    patch({
      capabilities: has
        ? state.capabilities.filter((c) => c !== id)
        : [...state.capabilities, id],
    });
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-8">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
            What should your receptionist do?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Select all that apply.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {CAPABILITY_OPTIONS.map((opt) => {
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
            When should this receptionist answer?
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

        <div>
          <Label htmlFor="solution-name">Solution name</Label>
          <Input
            id="solution-name"
            className="mt-1.5 max-w-lg"
            value={state.solutionName}
            onChange={(e) => patch({ solutionName: e.target.value })}
            placeholder="Main Office Appointment Receptionist"
          />
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
              Your AI receptionist will answer calls, help callers, and book appointments
              24/7—so you never miss an opportunity.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Required products
            </p>
            <ul className="mt-2 space-y-2 text-xs">
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-success" />
                <span>
                  <strong>Phone</strong> — Receive and manage calls
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-purple" />
                <span>
                  <strong>AI Voice</strong> — Power conversations with AI
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-accent" />
                <span>
                  <strong>Calendar</strong> — Book and manage appointments
                </span>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Optional products
            </p>
            <ul className="mt-2 space-y-2 text-xs">
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-success" />
                SMS — Send texts and reminders
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-orange" />
                CRM — Sync with your CRM
              </li>
            </ul>
          </div>
          <InfoCallout>
            After you continue, we&apos;ll automatically generate your visual workflow.
          </InfoCallout>
        </div>
      </SidePanel>
    </div>
  );
}
