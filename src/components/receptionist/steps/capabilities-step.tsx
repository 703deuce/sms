"use client";

import { Input } from "@/components/ui/input";
import {
  CAPABILITY_OPTIONS,
  DEFAULT_COLLECT_FIELDS,
  type CapabilityId,
  type CollectFieldId,
  type ReceptionistWizardState,
} from "@/lib/receptionist-wizard/types";
import { Sparkles } from "lucide-react";
import { SelectableCard, SidePanel, WizardFooter } from "../ui";

export function CapabilitiesStep({
  state,
  patch,
  onBack,
  onContinue,
  busy,
}: {
  state: ReceptionistWizardState;
  patch: (p: Partial<ReceptionistWizardState>) => void;
  onBack: () => void;
  onContinue: () => void;
  busy?: boolean;
}) {
  function toggleCap(id: CapabilityId) {
    const has = state.capabilities.includes(id);
    const next = has
      ? state.capabilities.filter((c) => c !== id)
      : [...state.capabilities, id];
    patch({ capabilities: next });
  }

  const collectInfo = state.capabilities.includes("collect_info");
  const bookAppts = state.capabilities.includes("book_appointments");

  const summaryCaps = CAPABILITY_OPTIONS.filter((c) => state.capabilities.includes(c.id));

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            What should your receptionist do?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose the capabilities you want {state.agentName || "Amy"} to handle. You can
            customize and refine these later anytime.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_OPTIONS.map((cap) => (
            <SelectableCard
              key={cap.id}
              selected={state.capabilities.includes(cap.id)}
              onClick={() => toggleCap(cap.id)}
              title={cap.label}
              description={cap.description}
              compact
            />
          ))}
        </div>

        {collectInfo ? (
          <div className="mt-8 voice-card p-5">
            <h3 className="text-sm font-semibold">Information Amy should collect</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              When Amy takes a message or collects caller info, what should she ask for?
            </p>
            <ol className="mt-4 space-y-2">
              {DEFAULT_COLLECT_FIELDS.map((field, i) => (
                <li
                  key={field.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm"
                >
                  <span>
                    <span className="font-medium text-muted-foreground">{i + 1}.</span>{" "}
                    {field.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {field.required ? "Required" : "Not required"}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Ask Amy to collect something else (e.g. Email, Order ID)"
                className="flex-1"
                readOnly
              />
              <button type="button" className="voice-btn-outline h-10 w-10 shrink-0">+</button>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                AI Intelligence: Amy will intelligently collect these details during the natural
                flow of the conversation.
              </span>
            </div>
          </div>
        ) : null}

        {bookAppts ? (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="font-medium text-foreground">Calendar connection</p>
            <p className="mt-1 text-muted-foreground">
              You can connect a calendar after activation under Appointments → Connections.
            </p>
          </div>
        ) : null}

        <WizardFooter
          showBack
          onBack={onBack}
          onContinue={onContinue}
          busy={busy}
        />
      </div>

      <SidePanel title="Agent summary">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
            {state.agentName.charAt(0) || "A"}
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {state.agentName || "Amy"} (Receptionist)
            </p>
            <p className="text-xs text-muted-foreground">{state.businessName || "Your business"}</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <span className="text-muted-foreground">Primary behavior:</span>{" "}
            {state.answerTiming === "every_call"
              ? "Every call"
              : state.answerTiming === "after_hours"
                ? "After hours"
                : state.answerTiming === "nobody_answers"
                  ? "When I don't answer"
                  : "Overflow"}
          </li>
        </ul>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Capabilities
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {CAPABILITY_OPTIONS.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <span
                className={
                  state.capabilities.includes(c.id) ? "text-primary" : "text-muted-foreground/50"
                }
              >
                {state.capabilities.includes(c.id) ? "✓" : "○"}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
          Almost there! Your agent is ready for voice and testing.
        </div>
      </SidePanel>
    </div>
  );
}
