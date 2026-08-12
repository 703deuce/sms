"use client";

import { Input, Label, Textarea } from "@/components/ui/input";
import {
  ANSWER_TIMING_OPTIONS,
  type ReceptionistWizardState,
} from "@/lib/receptionist-wizard/types";
import { generateGreeting } from "@/lib/receptionist-wizard/defaults";
import {
  Clock,
  Phone,
  PhoneForwarded,
  PhoneMissed,
  Sparkles,
  Users,
} from "lucide-react";
import { SelectableCard, SidePanel, WizardFooter } from "../ui";

const TIMING_ICONS = {
  every_call: Phone,
  after_hours: Clock,
  nobody_answers: PhoneMissed,
  overflow: Users,
} as const;

export function AboutStep({
  state,
  patch,
  onContinue,
  onCancel,
  busy,
}: {
  state: ReceptionistWizardState;
  patch: (p: Partial<ReceptionistWizardState>) => void;
  onContinue: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  function generateGreetingClick() {
    patch({ greeting: generateGreeting(state) });
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Tell us about your receptionist
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This helps the AI understand who they are and how to handle calls for your business.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <Label htmlFor="agent-name">Agent name</Label>
            <Input
              id="agent-name"
              className="mt-1.5"
              placeholder="Amy"
              value={state.agentName}
              onChange={(e) => patch({ agentName: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">This is for internal use only.</p>
          </div>

          <div>
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              className="mt-1.5"
              placeholder="John&apos;s Plumbing"
              value={state.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used when Amy introduces your business on calls.
            </p>
          </div>

          <div>
            <Label htmlFor="business-desc">What does your business do?</Label>
            <Textarea
              id="business-desc"
              className="mt-1.5 min-h-[100px]"
              placeholder="We are a plumbing company based in London that provides repair, maintenance, and emergency plumbing services for residential and commercial property."
              value={state.businessDescription}
              onChange={(e) => patch({ businessDescription: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Give a short description of what the business does.
            </p>
          </div>

          <div>
            <Label>When should your receptionist answer calls?</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {ANSWER_TIMING_OPTIONS.map((opt) => {
                const Icon = TIMING_ICONS[opt.id] || PhoneForwarded;
                return (
                  <SelectableCard
                    key={opt.id}
                    selected={state.answerTiming === opt.id}
                    onClick={() => patch({ answerTiming: opt.id })}
                    title={opt.label}
                    description={opt.description}
                    icon={<Icon className="h-5 w-5" />}
                    compact
                  />
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="greeting">Greeting</Label>
            <div className="mt-1.5 flex gap-2">
              <Textarea
                id="greeting"
                className="min-h-[80px] flex-1"
                value={state.greeting}
                onChange={(e) => patch({ greeting: e.target.value })}
              />
              <button
                type="button"
                onClick={generateGreetingClick}
                className="voice-btn-outline voice-btn-outline-purple shrink-0 self-start"
              >
                <Sparkles className="h-4 w-4" />
                Generate Greeting
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="language">Language</Label>
            <select
              id="language"
              className="mt-1.5 h-10 w-full max-w-xs rounded-lg border border-border bg-card px-3 text-sm"
              value={state.language}
              onChange={(e) => patch({ language: e.target.value })}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es-ES">Spanish</option>
            </select>
          </div>
        </div>

        <WizardFooter onCancel={onCancel} onContinue={onContinue} busy={busy} />
      </div>

      <SidePanel
        title="What happens next?"
        illustration={
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        }
      >
        <ul className="space-y-3 text-sm">
          <li>We&apos;ll use this information to build your AI and set expectations.</li>
          <li>Next you&apos;ll select the capabilities and skills your AI needs to handle.</li>
          <li>Then you&apos;ll test her in your browser and make sure she&apos;s perfect.</li>
        </ul>
        <a href="/help" className="mt-4 block text-sm font-medium text-primary hover:underline">
          Learn more about AI set up
        </a>
      </SidePanel>
    </div>
  );
}
