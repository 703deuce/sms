"use client";

import { IntentFieldEditor } from "@/components/realtor/intent-field-editor";
import { RealtorWorkflowPreview } from "@/components/realtor/workflow-preview";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STEP_LABELS } from "@/lib/realtor/workspace-config";
import { onboardingStepsForConfig } from "@/lib/realtor/wizard-steps";
import type {
  RealtorAmyMode,
  RealtorOnboardingStep,
  RealtorProductConfig,
  RealtorQualifiedOutcome,
} from "@/lib/realtor/types";
import { compileRealtorAgents } from "@/lib/voice/real-estate/compile";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  initialConfig: RealtorProductConfig;
  steps: RealtorOnboardingStep[];
};

export function RealtorOnboardingWizard({ initialConfig }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const steps = useMemo(() => onboardingStepsForConfig(config), [config]);
  const [stepIndex, setStepIndex] = useState(() =>
    Math.max(0, steps.indexOf(initialConfig.currentStep)),
  );
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const step = steps[Math.min(stepIndex, steps.length - 1)] || "intent";
  const compiled = useMemo(() => compileRealtorAgents(config), [config]);

  async function save(partial: Partial<RealtorProductConfig>, nextStep?: RealtorOnboardingStep) {
    setSaving(true);
    try {
      const res = await fetch("/api/realtor/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { ...partial, currentStep: nextStep || step },
        }),
      });
      const json = await res.json();
      if (json.config) setConfig(json.config);
      if (json.validation?.errors?.length) {
        setValidationErrors(json.validation.errors.map((e: { message: string }) => e.message));
      } else {
        setValidationErrors([]);
      }
    } finally {
      setSaving(false);
    }
  }

  async function goLive() {
    setSaving(true);
    try {
      const res = await fetch("/api/realtor/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "go_live", config }),
      });
      const json = await res.json();
      if (json.validation && !json.validation.ok) {
        setValidationErrors(json.validation.errors.map((e: { message: string }) => e.message));
        return;
      }
      if (json.config) setConfig(json.config);
      router.push("/realtor/dashboard");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function patch(partial: Partial<RealtorProductConfig>) {
    const next = { ...config, ...partial };
    setConfig(next);
    void save(partial);
  }

  function next() {
    const nextStep = steps[stepIndex + 1];
    if (!nextStep) return;
    void save({}, nextStep);
    setStepIndex(stepIndex + 1);
  }

  function back() {
    setStepIndex(Math.max(0, stepIndex - 1));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <p className="text-sm font-medium text-primary">Get Amy working</p>
        <h1 className="text-2xl font-bold tracking-tight">Configure your Real Estate agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {stepIndex + 1} of {steps.length}: {STEP_LABELS[step]} · Status: {config.status || "draft"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <span
            key={s}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              i === stepIndex
                ? "bg-primary text-primary-foreground"
                : i < stepIndex
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}. {STEP_LABELS[s]}
          </span>
        ))}
      </div>

      {validationErrors.length ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {validationErrors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      ) : null}

      <Card className="p-6">
        <WizardStepContent config={config} step={step} compiled={compiled} onChange={patch} onGoLive={() => void goLive()} />
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={back} disabled={stepIndex === 0 || saving}>
          Back
        </Button>
        {step === "go_live" ? (
          <Button onClick={() => void goLive()} disabled={saving}>
            {saving ? "Publishing…" : "Activate Amy"}
          </Button>
        ) : (
          <Button onClick={next} disabled={saving}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

function WizardStepContent({
  config,
  step,
  compiled,
  onChange,
  onGoLive,
}: {
  config: RealtorProductConfig;
  step: RealtorOnboardingStep;
  compiled: ReturnType<typeof compileRealtorAgents>;
  onChange: (p: Partial<RealtorProductConfig>) => void;
  onGoLive: () => void;
}) {
  if (step === "intent") {
    return (
      <IntentStep
        value={config.amyMode}
        onChange={(amyMode) => onChange({ amyMode })}
      />
    );
  }
  if (step === "business") {
    return (
      <BusinessStep
        value={config.business}
        identity={config.identity}
        onChange={(business) => onChange({ business })}
        onIdentityChange={(identity) => onChange({ identity })}
      />
    );
  }
  if (step === "phone") return <PhoneStep amyMode={config.amyMode} value={config.phone} onChange={(phone) => onChange({ phone })} />;
  if (step === "lead_sources") return <LeadSourcesStep value={config.leadSources} onChange={(leadSources) => onChange({ leadSources })} />;
  if (step === "calendar") return <CalendarStep value={config.appointmentTypes} onChange={(appointmentTypes) => onChange({ appointmentTypes })} />;
  if (step === "front_desk_capabilities") return <FrontDeskCapabilitiesStep config={config} onChange={onChange} />;
  if (step === "buyer_qualification") {
    return (
      <IntentFieldEditor
        intent="buyer"
        title="Buyer qualification fields"
        config={config.frontDesk.buyer}
        onChange={(buyer) => onChange({ frontDesk: { ...config.frontDesk, buyer } })}
      />
    );
  }
  if (step === "seller_qualification") {
    return (
      <IntentFieldEditor
        intent="seller"
        title="Seller qualification fields"
        config={config.frontDesk.seller}
        onChange={(seller) => onChange({ frontDesk: { ...config.frontDesk, seller } })}
      />
    );
  }
  if (step === "showing_config") {
    return (
      <IntentFieldEditor
        intent="showing"
        title="Showing request fields"
        config={config.frontDesk.showing}
        onChange={(showing) => onChange({ frontDesk: { ...config.frontDesk, showing } })}
      />
    );
  }
  if (step === "existing_client_config") {
    return (
      <IntentOutcomeStep
        title="Existing client behavior"
        config={config.frontDesk.existingClient}
        onChange={(existingClient) => onChange({ frontDesk: { ...config.frontDesk, existingClient } })}
      />
    );
  }
  if (step === "agent_to_agent_config") {
    return (
      <IntentOutcomeStep
        title="Other Realtor / agent-to-agent"
        config={config.frontDesk.agentToAgent}
        onChange={(agentToAgent) => onChange({ frontDesk: { ...config.frontDesk, agentToAgent } })}
      />
    );
  }
  if (step === "speed_lead_types") return <SpeedLeadTypesStep config={config} onChange={onChange} />;
  if (step === "outbound_buyer_qual") {
    return (
      <IntentFieldEditor
        intent="buyer"
        title="Outbound buyer qualification (Speed-to-Lead)"
        config={config.frontDesk.buyer}
        onChange={(buyer) => onChange({ frontDesk: { ...config.frontDesk, buyer } })}
        showOutcome={false}
      />
    );
  }
  if (step === "outbound_seller_qual") {
    return (
      <IntentFieldEditor
        intent="seller"
        title="Outbound seller qualification (Speed-to-Lead)"
        config={config.frontDesk.seller}
        onChange={(seller) => onChange({ frontDesk: { ...config.frontDesk, seller } })}
        showOutcome={false}
      />
    );
  }
  if (step === "first_call_timing") return <FirstCallTimingStep config={config} onChange={onChange} />;
  if (step === "follow_up") return <FollowUpStep config={config} onChange={onChange} />;
  if (step === "sms_email") return <SmsEmailStep config={config} onChange={onChange} />;
  if (step === "booking") return <BookingStep config={config} onChange={onChange} />;
  if (step === "transfers") return <TransfersStep config={config} onChange={onChange} />;
  if (step === "knowledge") return <KnowledgeStep config={config} onChange={onChange} />;
  if (step === "voice") return <VoiceStep config={config} onChange={onChange} />;
  if (step === "notifications") return <NotificationsStep config={config} onChange={onChange} />;
  if (step === "review") return <ReviewStep config={config} compiled={compiled} />;
  if (step === "test") return <TestStep config={config} />;
  if (step === "go_live") return <GoLiveStep config={config} onGoLive={onGoLive} />;
  return null;
}

function IntentStep({ value, onChange }: { value: RealtorAmyMode; onChange: (v: RealtorAmyMode) => void }) {
  const options = [
    { id: "front_desk" as const, title: "Answer my incoming calls", desc: "Front Desk" },
    { id: "speed_to_lead" as const, title: "Call new leads automatically", desc: "Speed-to-Lead" },
    { id: "both" as const, title: "Both", desc: "Front Desk + Speed-to-Lead" },
  ];
  return (
    <div className="space-y-4">
      <CardTitle>What do you want Amy to do?</CardTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-xl border p-4 text-left transition",
              value === opt.id ? "border-primary bg-primary/5 ring-2 ring-primary" : "hover:border-slate-300",
            )}
          >
            <p className="font-semibold">{opt.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function BusinessStep({
  value,
  identity,
  onChange,
  onIdentityChange,
}: {
  value: RealtorProductConfig["business"];
  identity?: RealtorProductConfig["identity"];
  onChange: (v: RealtorProductConfig["business"]) => void;
  onIdentityChange: (v: RealtorProductConfig["identity"]) => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>Identity & business</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Amy display name</span>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={identity?.agentName || "Amy"} onChange={(e) => onIdentityChange({ ...identity, agentName: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Team / company name</span>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={value.teamName || ""} onChange={(e) => onChange({ ...value, teamName: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Brokerage</span>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={value.brokerage || ""} onChange={(e) => onChange({ ...value, brokerage: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Service areas (comma-separated)</span>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={(value.serviceAreas || []).join(", ")}
            onChange={(e) =>
              onChange({
                ...value,
                serviceAreas: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Greeting note (optional)</span>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={identity?.greeting || ""} onChange={(e) => onIdentityChange({ ...identity, greeting: e.target.value })} placeholder="Warm welcome style — runtime uses structured config, not a giant prompt" />
        </label>
      </div>
    </div>
  );
}

function PhoneStep({ amyMode, value, onChange }: { amyMode: RealtorAmyMode; value: RealtorProductConfig["phone"]; onChange: (v: RealtorProductConfig["phone"]) => void }) {
  return (
    <div className="space-y-4">
      <CardTitle>Phone setup</CardTitle>
      {(amyMode === "front_desk" || amyMode === "both") && (
        <label className="block text-sm">
          <span className="font-medium">Transfer number</span>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={value.transferNumber || ""} onChange={(e) => onChange({ ...value, transferNumber: e.target.value })} />
        </label>
      )}
      {(amyMode === "speed_to_lead" || amyMode === "both") && (
        <label className="block text-sm">
          <span className="font-medium">Outbound caller ID (E.164)</span>
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={value.outboundNumberE164 || ""} onChange={(e) => onChange({ ...value, outboundNumberE164: e.target.value })} />
        </label>
      )}
    </div>
  );
}

function LeadSourcesStep({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const sources = ["Facebook", "Zillow", "Realtor.com", "Website", "Follow Up Boss", "HubSpot", "Webhook", "CSV"];
  return (
    <div className="space-y-4">
      <CardTitle>Lead sources</CardTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {sources.map((s) => (
          <label key={s} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <input type="checkbox" checked={value.includes(s)} onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))} />
            {s}
          </label>
        ))}
      </div>
    </div>
  );
}

function CalendarStep({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-4">
      <CardTitle>Appointment types Amy can book</CardTitle>
      {value.map((type, i) => (
        <input key={i} className="w-full rounded-lg border px-3 py-2 text-sm" value={type} onChange={(e) => { const next = [...value]; next[i] = e.target.value; onChange(next); }} />
      ))}
    </div>
  );
}

function FrontDeskCapabilitiesStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  const rows: Array<{ key: keyof RealtorProductConfig["frontDesk"]; label: string }> = [
    { key: "buyer", label: "Buyer / property inquiries" },
    { key: "seller", label: "Seller inquiries" },
    { key: "showing", label: "Showing requests" },
    { key: "existingClient", label: "Existing clients" },
    { key: "agentToAgent", label: "Other Realtors" },
    { key: "general", label: "General calls" },
  ];
  return (
    <div className="space-y-3">
      <CardTitle>What should Front Desk Amy handle?</CardTitle>
      {rows.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={config.frontDesk[key].enabled}
            onChange={(e) =>
              onChange({
                frontDesk: { ...config.frontDesk, [key]: { ...config.frontDesk[key], enabled: e.target.checked } },
              })
            }
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function IntentOutcomeStep({
  title,
  config,
  onChange,
}: {
  title: string;
  config: RealtorProductConfig["frontDesk"]["general"];
  onChange: (c: RealtorProductConfig["frontDesk"]["general"]) => void;
}) {
  const outcomes: RealtorQualifiedOutcome[] = ["book", "transfer", "notify", "message"];
  return (
    <div className="space-y-3">
      <CardTitle>{title}</CardTitle>
      <label className="block text-sm">
        When intake is complete:
        <select className="mt-1 w-full rounded-lg border px-3 py-2" value={config.qualifiedOutcome} onChange={(e) => onChange({ ...config, qualifiedOutcome: e.target.value as RealtorQualifiedOutcome })}>
          {outcomes.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function SpeedLeadTypesStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  return (
    <div className="space-y-3">
      <CardTitle>Speed-to-Lead lead types</CardTitle>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.speedToLead.buyerQualification} onChange={(e) => onChange({ speedToLead: { ...config.speedToLead, buyerQualification: e.target.checked } })} /> Buyer leads</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.speedToLead.sellerQualification} onChange={(e) => onChange({ speedToLead: { ...config.speedToLead, sellerQualification: e.target.checked } })} /> Seller leads</label>
      <label className="block text-sm">
        Qualified outcome:
        <select className="mt-1 w-full rounded-lg border px-3 py-2" value={config.speedToLead.qualifiedOutcome} onChange={(e) => onChange({ speedToLead: { ...config.speedToLead, qualifiedOutcome: e.target.value as RealtorQualifiedOutcome } })}>
          <option value="book">Book appointment</option>
          <option value="transfer">Transfer</option>
          <option value="notify">Notify realtor</option>
          <option value="message">Take message</option>
        </select>
      </label>
    </div>
  );
}

function FirstCallTimingStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  return (
    <div className="space-y-3">
      <CardTitle>First-call timing</CardTitle>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={config.speedToLead.callImmediately} onChange={(e) => onChange({ speedToLead: { ...config.speedToLead, callImmediately: e.target.checked, firstCallDelayMinutes: e.target.checked ? 0 : config.speedToLead.firstCallDelayMinutes } })} />
        Call immediately when lead arrives
      </label>
      {!config.speedToLead.callImmediately && (
        <label className="block text-sm">
          Delay (minutes)
          <input type="number" min={1} className="mt-1 w-full rounded-lg border px-3 py-2" value={config.speedToLead.firstCallDelayMinutes || 5} onChange={(e) => onChange({ speedToLead: { ...config.speedToLead, firstCallDelayMinutes: Number(e.target.value) } })} />
        </label>
      )}
    </div>
  );
}

function FollowUpStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  return (
    <div className="space-y-4">
      <CardTitle>Retry & follow-up</CardTitle>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={config.speedToLead.useRecommendedFollowUp} onChange={(e) => onChange({ speedToLead: { ...config.speedToLead, useRecommendedFollowUp: e.target.checked } })} />
        Use recommended follow-up sequence
      </label>
      <label className="block text-sm">
        Max call attempts
        <input type="number" min={1} max={10} className="mt-1 w-full rounded-lg border px-3 py-2" value={config.speedToLead.maxAttempts || 3} onChange={(e) => onChange({ speedToLead: { ...config.speedToLead, maxAttempts: Number(e.target.value) } })} />
      </label>
    </div>
  );
}

function SmsEmailStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  return (
    <div className="space-y-3">
      <CardTitle>SMS & email follow-up</CardTitle>
      <p className="text-sm text-muted-foreground">Recommended automation sends SMS on no-answer, retries calls, and day-2 SMS.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={config.speedToLead.useRecommendedFollowUp} onChange={(e) => onChange({ speedToLead: { ...config.speedToLead, useRecommendedFollowUp: e.target.checked } })} />
        Enable SMS steps in follow-up automation
      </label>
    </div>
  );
}

function BookingStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  return (
    <div className="space-y-3">
      <CardTitle>Booking behavior</CardTitle>
      <p className="text-sm text-muted-foreground">Amy books using your connected Calendly calendar. Map appointment types under Integrations.</p>
      <ul className="text-sm">{config.appointmentTypes.map((t) => <li key={t}>• {t}</li>)}</ul>
    </div>
  );
}

function TransfersStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">Transfer destination</span>
      <input className="mt-1 w-full rounded-lg border px-3 py-2" value={config.phone.transferNumber || ""} onChange={(e) => onChange({ phone: { ...config.phone, transferNumber: e.target.value } })} />
    </label>
  );
}

function KnowledgeStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  return (
    <div className="space-y-3">
      <CardTitle>Knowledge base</CardTitle>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={config.knowledge?.useRecommended !== false} onChange={(e) => onChange({ knowledge: { ...config.knowledge, useRecommended: e.target.checked } })} />
        Use recommended Realtor knowledge categories
      </label>
      <label className="block text-sm">
        Additional notes (one per line)
        <textarea className="mt-1 w-full rounded-lg border px-3 py-2" rows={4} value={(config.knowledge?.customNotes || []).join("\n")} onChange={(e) => onChange({ knowledge: { ...config.knowledge, customNotes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } })} />
      </label>
    </div>
  );
}

function VoiceStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <CardTitle className="sm:col-span-2">Voice</CardTitle>
      <label className="block text-sm">Model<input className="mt-1 w-full rounded-lg border px-3 py-2" value={config.voice?.model || ""} onChange={(e) => onChange({ voice: { ...config.voice, model: e.target.value } })} /></label>
      <label className="block text-sm">Voice<input className="mt-1 w-full rounded-lg border px-3 py-2" value={config.voice?.voice || ""} onChange={(e) => onChange({ voice: { ...config.voice, voice: e.target.value } })} /></label>
    </div>
  );
}

function NotificationsStep({ config, onChange }: { config: RealtorProductConfig; onChange: (p: Partial<RealtorProductConfig>) => void }) {
  return (
    <div className="space-y-3">
      <CardTitle>Notifications</CardTitle>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.notifications?.onQualified !== false} onChange={(e) => onChange({ notifications: { ...config.notifications, onQualified: e.target.checked } })} /> Notify when lead qualified</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.notifications?.onAppointmentBooked !== false} onChange={(e) => onChange({ notifications: { ...config.notifications, onAppointmentBooked: e.target.checked } })} /> Notify when appointment booked</label>
      <label className="block text-sm">Email recipients (comma-separated)<input className="mt-1 w-full rounded-lg border px-3 py-2" value={(config.notifications?.emailRecipients || []).join(", ")} onChange={(e) => onChange({ notifications: { ...config.notifications, emailRecipients: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })} /></label>
    </div>
  );
}

function ReviewStep({ config, compiled }: { config: RealtorProductConfig; compiled: ReturnType<typeof compileRealtorAgents> }) {
  return (
    <div className="space-y-4">
      <CardTitle>Review configuration</CardTitle>
      <p className="text-sm text-muted-foreground">This is your structured configuration — not a custom prompt. The workflow below reflects what Amy will do.</p>
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        <li>Mode: {config.amyMode}</li>
        <li>Company: {config.business.teamName || config.business.brokerage || "—"}</li>
        <li>Compiled version: {compiled.compiledVersion}</li>
        <li>Status: {config.status || "draft"}</li>
      </ul>
      {compiled.frontDesk?.workflowDefinition ? (
        <div>
          <p className="mb-2 text-sm font-medium">Front Desk workflow</p>
          <RealtorWorkflowPreview definition={compiled.frontDesk.workflowDefinition} height={360} />
        </div>
      ) : null}
      {compiled.speedToLead?.workflowDefinition ? (
        <div>
          <p className="mb-2 text-sm font-medium">Speed-to-Lead workflow</p>
          <RealtorWorkflowPreview definition={compiled.speedToLead.workflowDefinition} height={280} />
        </div>
      ) : null}
    </div>
  );
}

function TestStep({ config }: { config: RealtorProductConfig }) {
  return (
    <div className="space-y-4">
      <CardTitle>Test Amy</CardTitle>
      <p className="text-sm">Test using the same compiled configuration as production — save draft, then test calls and leads.</p>
      <Link href="/realtor/test" className="inline-flex h-9 items-center rounded-md border px-4 text-sm">Open Test Agent</Link>
    </div>
  );
}

function GoLiveStep({ config, onGoLive }: { config: RealtorProductConfig; onGoLive: () => void }) {
  return (
    <div className="space-y-4">
      <CardTitle>Activate Amy</CardTitle>
      <p className="text-sm text-muted-foreground">Publishing creates immutable agent versions. New calls use the published config; in-progress calls finish on the version they started with.</p>
      <ul className="space-y-2 text-sm">
        <li>Front Desk: {config.amyMode !== "speed_to_lead" ? "Will deploy" : "Off"}</li>
        <li>Speed-to-Lead: {config.amyMode !== "front_desk" ? "Will deploy" : "Off"}</li>
      </ul>
      <Button onClick={onGoLive}>Publish & Activate</Button>
    </div>
  );
}
