"use client";

import { Input, Label, Textarea } from "@/components/ui/input";
import {
  ANSWER_TIMING_OPTIONS,
  type ReceptionistWizardState,
} from "@/lib/receptionist-wizard/types";
import { generateGreeting } from "@/lib/receptionist-wizard/defaults";
import { PhoneNumberSelect } from "../phone-number-select";
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
  phoneNumberId,
  onPhoneChange,
}: {
  state: ReceptionistWizardState;
  patch: (p: Partial<ReceptionistWizardState>) => void;
  onContinue: () => void;
  onCancel: () => void;
  busy?: boolean;
  phoneNumberId?: string | null;
  onPhoneChange?: (id: string | null) => void;
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
              Short public-facing description — compiled into BUSINESS on every call.
            </p>
          </div>

          <div>
            <Label htmlFor="agent-job">What should your receptionist do?</Label>
            <Textarea
              id="agent-job"
              className="mt-1.5 min-h-[140px]"
              placeholder="Answer incoming calls. Answer basic questions. For service requests, collect name, callback number, and address. Take messages when needed. Transfer emergencies when appropriate."
              value={state.agentJobInstructions}
              onChange={(e) => patch({ agentJobInstructions: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This is your job description for the agent — loaded on every call, not retrieved from
              Knowledge.
            </p>
          </div>

          <div>
            <Label htmlFor="additional-instructions">Additional instructions (optional)</Label>
            <Textarea
              id="additional-instructions"
              className="mt-1.5 min-h-[80px]"
              placeholder="We pride ourselves on being friendly. If someone sounds upset, apologize before collecting information."
              value={state.additionalInstructions}
              onChange={(e) => patch({ additionalInstructions: e.target.value })}
            />
          </div>

          <details className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Structured business details (optional)
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              These compile into the always-loaded BUSINESS section. Leave blank to extract hints
              from your description where possible.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="business-hours">Hours</Label>
                <Textarea
                  id="business-hours"
                  className="mt-1.5 min-h-[72px]"
                  placeholder="Monday-Friday: 8 AM-6 PM&#10;Saturday: 9 AM-2 PM&#10;Sunday: Closed"
                  value={state.businessHours}
                  onChange={(e) => patch({ businessHours: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="service-area">Service area</Label>
                <Textarea
                  id="service-area"
                  className="mt-1.5 min-h-[60px]"
                  placeholder="Woodbridge, Dale City, Lake Ridge, and surrounding areas"
                  value={state.serviceArea}
                  onChange={(e) => patch({ serviceArea: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="core-services">Core services</Label>
                <Textarea
                  id="core-services"
                  className="mt-1.5 min-h-[100px]"
                  placeholder="Electrical repairs&#10;Panel upgrades&#10;EV charger installation&#10;Emergency electrical service"
                  value={state.coreServices}
                  onChange={(e) => patch({ coreServices: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pricing-notes">Pricing / fees</Label>
                <Textarea
                  id="pricing-notes"
                  className="mt-1.5 min-h-[60px]"
                  placeholder="Standard service-call fee is $89. Do not quote exact repair prices unless listed."
                  value={state.pricingNotes}
                  onChange={(e) => patch({ pricingNotes: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="important-facts">Important company facts</Label>
                <Textarea
                  id="important-facts"
                  className="mt-1.5 min-h-[60px]"
                  placeholder="Licensed and insured. Same-day emergency service available."
                  value={state.importantFacts}
                  onChange={(e) => patch({ importantFacts: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="business-address">Address (optional)</Label>
                <Input
                  id="business-address"
                  className="mt-1.5"
                  placeholder="123 Main St, Woodbridge, VA"
                  value={state.businessAddress}
                  onChange={(e) => patch({ businessAddress: e.target.value })}
                />
              </div>
            </div>
          </details>

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

          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              className="mt-1.5 h-10 w-full max-w-md rounded-lg border border-border bg-card px-3 text-sm"
              value={state.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
            >
              <option value="America/New_York">Eastern (US)</option>
              <option value="America/Chicago">Central (US)</option>
              <option value="America/Denver">Mountain (US)</option>
              <option value="America/Los_Angeles">Pacific (US)</option>
              <option value="Europe/London">London</option>
            </select>
          </div>

          {onPhoneChange ? (
            <div>
              <Label>Phone number</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Assign a number so callers reach this agent when deployed.
              </p>
              <PhoneNumberSelect
                className="mt-1.5"
                value={phoneNumberId || null}
                onChange={onPhoneChange}
              />
            </div>
          ) : null}
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
