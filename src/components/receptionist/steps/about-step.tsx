"use client";

import { Input, Label, Textarea } from "@/components/ui/input";
import {
  INDUSTRY_OPTIONS,
  type ReceptionistWizardState,
} from "@/lib/receptionist-wizard/types";
import { defaultAgentJobInstructions } from "@/lib/receptionist-wizard/defaults";
import { Bot, Check, Sparkles } from "lucide-react";
import { SidePanel, WizardFooter, WizardSection } from "../ui";

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

  function generatePersonality() {
    patch({
      agentPersonalityNotes: `You are ${agent}, a helpful and professional receptionist for ${state.businessName.trim() || "the business"}. You speak clearly, stay calm under pressure, and make callers feel welcomed.`,
    });
  }

  function ensureJobInstructions() {
    if (!state.agentJobInstructions.trim()) {
      patch({ agentJobInstructions: defaultAgentJobInstructions(state.businessName) });
    }
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#6366f1]/10">
            <Bot className="h-6 w-6 text-[#6366f1]" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
              About Your Receptionist
            </h1>
            <p className="mt-1 text-sm text-[#6b7280]">
              Tell us about your business and your receptionist&apos;s personality.
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="agent-name" className="text-xs font-semibold text-[#374151]">
              Agent Name
            </Label>
            <Input
              id="agent-name"
              className="mt-1.5 h-11 border-[#e6e8ef]"
              placeholder="Amy"
              value={state.agentName}
              onChange={(e) => patch({ agentName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="business-name" className="text-xs font-semibold text-[#374151]">
              Business Name
            </Label>
            <Input
              id="business-name"
              className="mt-1.5 h-11 border-[#e6e8ef]"
              placeholder="John&apos;s Plumbing"
              value={state.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="industry" className="text-xs font-semibold text-[#374151]">
              Industry
            </Label>
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

        <div className="space-y-5">
          <WizardSection
            number={1}
            title="Tell us about your business"
            subtitle="Recommended 100–200 words. Compiled into BUSINESS on every call."
            action={
              <button
                type="button"
                onClick={regenerateBusinessDescription}
                className="voice-btn-outline text-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Regenerate
              </button>
            }
          >
            <Textarea
              id="business-desc"
              className="min-h-[140px] border-[#e6e8ef] text-sm"
              placeholder="We are a plumbing company that provides repair, maintenance, and emergency plumbing services for residential and commercial customers."
              value={state.businessDescription}
              onChange={(e) => patch({ businessDescription: e.target.value })}
            />
            <p className="mt-2 text-xs text-[#9ca3af]">{descWords} words</p>
            <details className="mt-4 rounded-lg border border-[#e6e8ef] bg-[#f8f9fc] p-4">
              <summary className="cursor-pointer text-xs font-semibold text-[#374151]">
                Structured business details (hours, services, pricing)
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Hours</Label>
                  <Textarea
                    className="mt-1 min-h-[72px] text-sm"
                    placeholder="Monday-Friday: 8 AM-6 PM"
                    value={state.businessHours}
                    onChange={(e) => patch({ businessHours: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Service area</Label>
                  <Textarea
                    className="mt-1 min-h-[72px] text-sm"
                    value={state.serviceArea}
                    onChange={(e) => patch({ serviceArea: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Core services</Label>
                  <Textarea
                    className="mt-1 min-h-[72px] text-sm"
                    value={state.coreServices}
                    onChange={(e) => patch({ coreServices: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Pricing / fees</Label>
                  <Textarea
                    className="mt-1 min-h-[72px] text-sm"
                    value={state.pricingNotes}
                    onChange={(e) => patch({ pricingNotes: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Address</Label>
                  <Input
                    className="mt-1 text-sm"
                    value={state.businessAddress}
                    onChange={(e) => patch({ businessAddress: e.target.value })}
                  />
                </div>
              </div>
            </details>
          </WizardSection>

          <WizardSection
            number={2}
            title={`Tell us about ${agent}`}
            subtitle="Personality and speaking style — compiled into AGENT."
            optional
            action={
              <button type="button" onClick={generatePersonality} className="voice-btn-outline text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Generate
              </button>
            }
          >
            <Textarea
              className="min-h-[100px] border-[#e6e8ef] text-sm"
              placeholder="Professional, warm, and patient. Speaks clearly and keeps calls moving."
              value={state.agentPersonalityNotes}
              onChange={(e) => patch({ agentPersonalityNotes: e.target.value })}
            />
          </WizardSection>

          <WizardSection
            number={3}
            title="What should your receptionist do on calls?"
            subtitle="YOUR JOB — describe responsibilities in your own words."
            action={
              <button type="button" onClick={ensureJobInstructions} className="voice-btn-outline text-xs">
                Use template
              </button>
            }
          >
            <Textarea
              className="min-h-[120px] border-[#e6e8ef] text-sm"
              placeholder="Answer incoming calls. For service requests, collect name, callback number, service address, and problem description."
              value={state.agentJobInstructions}
              onChange={(e) => patch({ agentJobInstructions: e.target.value })}
            />
          </WizardSection>

          <WizardSection
            number={4}
            title={`Anything else ${agent} should know?`}
            subtitle="Additional customer instructions — optional escape hatch for business rules."
            optional
          >
            <Textarea
              className="min-h-[80px] border-[#e6e8ef] text-sm"
              placeholder="Never schedule same-day appointments after 3 PM. Do not transfer employment calls."
              value={state.additionalInstructions}
              onChange={(e) => patch({ additionalInstructions: e.target.value })}
            />
          </WizardSection>
        </div>

        <WizardFooter onCancel={onCancel} onContinue={onContinue} busy={busy} />
      </div>

      <SidePanel
        title="What happens next?"
        illustration={
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#6366f1] shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
          </div>
        }
      >
        <ul className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6366f1]/10 text-[10px] font-bold text-[#6366f1]">
              1
            </span>
            <span>Set business information, personality, and job instructions.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6366f1]/10 text-[10px] font-bold text-[#6366f1]">
              2
            </span>
            <span>Choose capabilities, collection fields, and integrations.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6366f1]/10 text-[10px] font-bold text-[#6366f1]">
              3
            </span>
            <span>Test your receptionist and activate on a phone number.</span>
          </li>
        </ul>
        <div className="mt-6 border-t border-[#e6e8ef] pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
            Top Tips for {agent}
          </p>
          <ul className="mt-3 space-y-2">
            {[
              "Keep your instructions clear and concise.",
              "Specify your business hours and location.",
              "Give clear instructions on what to collect.",
              "Review and refine setup over time.",
              "Test your voice agent often.",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-xs text-[#6b7280]">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </SidePanel>
    </div>
  );
}
