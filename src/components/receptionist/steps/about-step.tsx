"use client";

import { Input, Textarea } from "@/components/ui/input";
import {
  INDUSTRY_OPTIONS,
  type ReceptionistWizardState,
} from "@/lib/receptionist-wizard/types";
import { defaultAgentJobInstructions } from "@/lib/receptionist-wizard/defaults";
import { Bot } from "lucide-react";
import {
  AboutNextPanel,
  WizardFieldLabel,
  WizardFooter,
  WizardPageHeader,
  WizardPageLayout,
  WizardQuestionBlock,
  WizardTextareaField,
} from "../ui";

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

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
  const agent = state.agentName.trim() || "Amy";
  const descWords = wordCount(state.businessDescription);

  function regenerateBusinessDescription() {
    const industry = state.industry.trim() || "service";
    const business = state.businessName.trim() || "our business";
    patch({
      businessDescription: `${business} is a ${industry.toLowerCase()} business serving local customers with professional, reliable service.`,
    });
  }

  function generateWhatItShouldKnow() {
    const personality = `You are ${agent}, a helpful and professional receptionist for ${state.businessName.trim() || "the business"}. You speak clearly, stay calm under pressure, and make callers feel welcomed.`;
    const job =
      state.agentJobInstructions.trim() || defaultAgentJobInstructions(state.businessName);
    patch({
      agentPersonalityNotes: personality,
      agentJobInstructions: job,
    });
  }

  return (
    <WizardPageLayout
      wideAside
      aside={
        <AboutNextPanel
          agent={agent}
          steps={[
            { color: "bg-[#6366f1]", text: "Set personality and business knowledge for your agent." },
            { color: "bg-violet-500", text: "Choose how calls are handled and what to collect." },
            { color: "bg-indigo-500", text: "Test voice quality and connect your phone number." },
          ]}
          tips={[
            "Be specific about services and service area.",
            "Mention business hours and after-hours rules.",
            "List tools and integrations your agent can use.",
            "Keep instructions concise and actionable.",
            "Test often as you refine setup.",
          ]}
        />
      }
    >
      <WizardPageHeader
        icon={<Bot className="h-5 w-5 text-[#6366f1]" />}
        title="About Your Receptionist"
        subtitle="Tell us about your business and what your receptionist should know."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div>
          <WizardFieldLabel hint="Internal name for this agent">Agent Name</WizardFieldLabel>
          <Input
            id="agent-name"
            className="mt-1.5 h-11 border-[#e6e8ef]"
            placeholder="Amy"
            value={state.agentName}
            onChange={(e) => patch({ agentName: e.target.value })}
          />
        </div>
        <div>
          <WizardFieldLabel hint="Used when introducing your business on calls">Business Name</WizardFieldLabel>
          <Input
            id="business-name"
            className="mt-1.5 h-11 border-[#e6e8ef]"
            placeholder="Zenith Marketing"
            value={state.businessName}
            onChange={(e) => patch({ businessName: e.target.value })}
          />
        </div>
        <div>
          <WizardFieldLabel hint="Helps tailor suggestions">Industry</WizardFieldLabel>
          <select
            id="industry"
            className="mt-1.5 h-11 w-full rounded-lg border border-[#e6e8ef] bg-white px-3 text-sm text-[#374151]"
            value={state.industry}
            onChange={(e) => patch({ industry: e.target.value })}
          >
            <option value="">Select industry</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <WizardQuestionBlock
          number={1}
          title="Tell us about your business"
          subtitle="Compiled into BUSINESS on every call."
        >
          <WizardTextareaField
            id="business-desc"
            value={state.businessDescription}
            onChange={(v) => patch({ businessDescription: v })}
            placeholder="We are a plumbing company that provides repair, maintenance, and emergency plumbing services for residential and commercial customers."
            minHeight={140}
            wordHint={`Recommended 100 words · ${descWords} words`}
            onAiSuggest={regenerateBusinessDescription}
            aiLabel="AI suggestions"
          />
          <details className="mt-3 rounded-lg border border-[#e6e8ef] bg-[#f8f9fc] p-4">
            <summary className="cursor-pointer text-xs font-semibold text-[#374151]">
              Structured business details (hours, services, pricing)
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <WizardFieldLabel>Hours</WizardFieldLabel>
                <Textarea
                  className="mt-1 min-h-[72px] text-sm"
                  placeholder="Monday–Friday: 8 AM–6 PM"
                  value={state.businessHours}
                  onChange={(e) => patch({ businessHours: e.target.value })}
                />
              </div>
              <div>
                <WizardFieldLabel>Service area</WizardFieldLabel>
                <Textarea
                  className="mt-1 min-h-[72px] text-sm"
                  value={state.serviceArea}
                  onChange={(e) => patch({ serviceArea: e.target.value })}
                />
              </div>
              <div>
                <WizardFieldLabel>Core services</WizardFieldLabel>
                <Textarea
                  className="mt-1 min-h-[72px] text-sm"
                  value={state.coreServices}
                  onChange={(e) => patch({ coreServices: e.target.value })}
                />
              </div>
              <div>
                <WizardFieldLabel>Pricing / fees</WizardFieldLabel>
                <Textarea
                  className="mt-1 min-h-[72px] text-sm"
                  value={state.pricingNotes}
                  onChange={(e) => patch({ pricingNotes: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <WizardFieldLabel>Address</WizardFieldLabel>
                <Input
                  className="mt-1 text-sm"
                  value={state.businessAddress}
                  onChange={(e) => patch({ businessAddress: e.target.value })}
                />
              </div>
            </div>
          </details>
        </WizardQuestionBlock>

        <WizardQuestionBlock
          number={2}
          title="What should it know?"
          subtitle="Personality and responsibilities — compiled into AGENT and YOUR JOB."
        >
          <WizardTextareaField
            value={state.agentPersonalityNotes}
            onChange={(v) => patch({ agentPersonalityNotes: v })}
            placeholder="Professional, warm, and patient. Speaks clearly and keeps calls moving."
            minHeight={88}
            onAiSuggest={generateWhatItShouldKnow}
            aiLabel="AI suggestions"
          />
          <div className="mt-3">
            <WizardFieldLabel>What should it do on calls?</WizardFieldLabel>
            <WizardTextareaField
              value={state.agentJobInstructions}
              onChange={(v) => patch({ agentJobInstructions: v })}
              placeholder="Answer incoming calls. For service requests, collect name, callback number, service address, and problem description."
              minHeight={100}
            />
          </div>
        </WizardQuestionBlock>

        <WizardQuestionBlock
          number={3}
          title="Anything else it should know?"
          subtitle="Optional business rules and edge cases."
          optional
        >
          <WizardTextareaField
            value={state.additionalInstructions}
            onChange={(v) => patch({ additionalInstructions: v })}
            placeholder="Never schedule same-day appointments after 3 PM. Do not transfer employment calls."
            minHeight={80}
          />
        </WizardQuestionBlock>
      </div>

      <WizardFooter onCancel={onCancel} onContinue={onContinue} busy={busy} />
    </WizardPageLayout>
  );
}
