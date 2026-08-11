"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  RealtorAmyMode,
  RealtorOnboardingStep,
  RealtorProductConfig,
} from "@/lib/realtor/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  initialConfig: RealtorProductConfig;
  steps: RealtorOnboardingStep[];
};

const STEP_LABELS: Record<RealtorOnboardingStep, string> = {
  intent: "What Amy does",
  business: "Business",
  phone: "Phone",
  lead_sources: "Lead Sources",
  calendar: "Calendar",
  ai_setup: "Configure Amy",
  follow_up: "Follow-Up",
  test: "Test Amy",
  go_live: "Go Live",
};

export function RealtorOnboardingWizard({ initialConfig, steps }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [stepIndex, setStepIndex] = useState(() =>
    Math.max(0, steps.indexOf(initialConfig.currentStep)),
  );
  const [saving, setSaving] = useState(false);
  const step = steps[stepIndex] || "intent";

  async function save(partial: Partial<RealtorProductConfig>, nextStep?: RealtorOnboardingStep) {
    setSaving(true);
    try {
      const res = await fetch("/api/realtor/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            ...partial,
            currentStep: nextStep || step,
          },
        }),
      });
      const json = await res.json();
      if (json.config) setConfig(json.config);
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
      if (json.config) setConfig(json.config);
      router.push("/realtor/dashboard");
      router.refresh();
    } finally {
      setSaving(false);
    }
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
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <p className="text-sm font-medium text-primary">Get Amy working</p>
        <h1 className="text-2xl font-bold tracking-tight">Welcome to Transovo Real Estate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {stepIndex + 1} of {steps.length}: {STEP_LABELS[step]}
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

      <Card className="p-6">
        {step === "intent" ? (
          <IntentStep
            value={config.amyMode}
            onChange={(amyMode) => {
              setConfig({ ...config, amyMode });
              void save({ amyMode });
            }}
          />
        ) : null}
        {step === "business" ? (
          <BusinessStep
            value={config.business}
            onChange={(business) => {
              setConfig({ ...config, business });
              void save({ business });
            }}
          />
        ) : null}
        {step === "phone" ? (
          <PhoneStep
            amyMode={config.amyMode}
            value={config.phone}
            onChange={(phone) => {
              setConfig({ ...config, phone });
              void save({ phone });
            }}
          />
        ) : null}
        {step === "lead_sources" ? (
          <LeadSourcesStep
            value={config.leadSources}
            onChange={(leadSources) => {
              setConfig({ ...config, leadSources });
              void save({ leadSources });
            }}
          />
        ) : null}
        {step === "calendar" ? (
          <CalendarStep
            value={config.appointmentTypes}
            onChange={(appointmentTypes) => {
              setConfig({ ...config, appointmentTypes });
              void save({ appointmentTypes });
            }}
          />
        ) : null}
        {step === "ai_setup" ? (
          <AiSetupStep config={config} onChange={(partial) => void save(partial)} />
        ) : null}
        {step === "follow_up" ? (
          <FollowUpStep
            value={config.speedToLead.useRecommendedFollowUp}
            onChange={(useRecommendedFollowUp) => {
              setConfig({
                ...config,
                speedToLead: { ...config.speedToLead, useRecommendedFollowUp },
              });
              void save({ speedToLead: { ...config.speedToLead, useRecommendedFollowUp } });
            }}
          />
        ) : null}
        {step === "test" ? <TestStep phoneE164={config.phone.outboundNumberE164} /> : null}
        {step === "go_live" ? <GoLiveStep config={config} onGoLive={() => void goLive()} /> : null}
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={back} disabled={stepIndex === 0 || saving}>
          Back
        </Button>
        {step === "go_live" ? (
          <Button onClick={() => void goLive()} disabled={saving}>
            {saving ? "Deploying Amy…" : "Go Live"}
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

function IntentStep({
  value,
  onChange,
}: {
  value: RealtorAmyMode;
  onChange: (v: RealtorAmyMode) => void;
}) {
  const options: { id: RealtorAmyMode; title: string; desc: string }[] = [
    { id: "front_desk", title: "Answer my incoming calls", desc: "Front Desk" },
    { id: "speed_to_lead", title: "Call my new leads automatically", desc: "Speed-to-Lead" },
    { id: "both", title: "Both", desc: "Front Desk + Speed-to-Lead" },
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
  onChange,
}: {
  value: RealtorProductConfig["business"];
  onChange: (v: RealtorProductConfig["business"]) => void;
}) {
  const fields: Array<{ key: keyof RealtorProductConfig["business"]; label: string }> = [
    { key: "teamName", label: "Realtor / team name" },
    { key: "brokerage", label: "Brokerage" },
    { key: "website", label: "Website" },
    { key: "officePhone", label: "Office number" },
    { key: "businessHours", label: "Business hours" },
    { key: "timezone", label: "Time zone" },
  ];
  return (
    <div className="space-y-4">
      <CardTitle>Business profile</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="font-medium">{f.label}</span>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={String(value[f.key] || "")}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function PhoneStep({
  amyMode,
  value,
  onChange,
}: {
  amyMode: RealtorAmyMode;
  value: RealtorProductConfig["phone"];
  onChange: (v: RealtorProductConfig["phone"]) => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>Phone setup</CardTitle>
      {(amyMode === "front_desk" || amyMode === "both") && (
        <div className="space-y-2">
          <p className="text-sm font-medium">How should Amy receive calls?</p>
          {(["transovo_number", "forward"] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={value.mode === mode}
                onChange={() => onChange({ ...value, mode })}
              />
              {mode === "transovo_number" ? "Use a new Transovo number" : "Forward my existing number"}
            </label>
          ))}
          <label className="block text-sm">
            <span className="font-medium">Transfer number</span>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={value.transferNumber || ""}
              onChange={(e) => onChange({ ...value, transferNumber: e.target.value })}
            />
          </label>
        </div>
      )}
      {(amyMode === "speed_to_lead" || amyMode === "both") && (
        <p className="text-sm text-muted-foreground">
          Amy will use your Transovo number for outbound Speed-to-Lead. Callbacks route to Front Desk when
          enabled.
        </p>
      )}
    </div>
  );
}

function LeadSourcesStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const sources = ["Facebook", "Zillow", "Realtor.com", "Website", "Follow Up Boss", "HubSpot", "Webhook", "CSV"];
  return (
    <div className="space-y-4">
      <CardTitle>Where do your leads come from?</CardTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        {sources.map((s) => (
          <label key={s} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(s)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, s] : value.filter((x) => x !== s))
              }
            />
            {s}
          </label>
        ))}
      </div>
    </div>
  );
}

function CalendarStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>What should Amy schedule?</CardTitle>
      <div className="space-y-2">
        {value.map((type, i) => (
          <input
            key={i}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={type}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Connect Calendly under Integrations — Amy books using your connected calendar.
      </p>
    </div>
  );
}

function AiSetupStep({
  config,
  onChange,
}: {
  config: RealtorProductConfig;
  onChange: (p: Partial<RealtorProductConfig>) => void;
}) {
  const intentRows: Array<{
    key: keyof RealtorProductConfig["frontDesk"];
    label: string;
  }> = [
    { key: "buyer", label: "Buyer / property inquiries" },
    { key: "seller", label: "Seller inquiries" },
    { key: "showing", label: "Showing requests" },
    { key: "existingClient", label: "Existing clients" },
    { key: "agentToAgent", label: "Other Realtors" },
    { key: "general", label: "General calls" },
  ];

  function toggleIntent(key: keyof RealtorProductConfig["frontDesk"], enabled: boolean) {
    onChange({
      frontDesk: {
        ...config.frontDesk,
        [key]: { ...config.frontDesk[key], enabled },
      },
    });
  }

  return (
    <div className="space-y-6">
      <CardTitle>Configure Amy</CardTitle>
      <p className="text-sm text-muted-foreground">
        These settings are saved as structured configuration — Amy&apos;s runtime walks your field
        schemas; we do not generate giant custom prompts.
      </p>

      {(config.amyMode === "front_desk" || config.amyMode === "both") && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Front Desk — what Amy handles</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {intentRows.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.frontDesk[key].enabled}
                  onChange={(e) => toggleIntent(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {(config.amyMode === "speed_to_lead" || config.amyMode === "both") && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Speed-to-Lead — lead types</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.speedToLead.buyerQualification}
              onChange={(e) =>
                onChange({
                  speedToLead: { ...config.speedToLead, buyerQualification: e.target.checked },
                })
              }
            />
            Buyer qualification
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.speedToLead.sellerQualification}
              onChange={(e) =>
                onChange({
                  speedToLead: { ...config.speedToLead, sellerQualification: e.target.checked },
                })
              }
            />
            Seller qualification
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.speedToLead.callImmediately}
              onChange={(e) =>
                onChange({
                  speedToLead: { ...config.speedToLead, callImmediately: e.target.checked },
                })
              }
            />
            Call new leads immediately
          </label>
        </div>
      )}

      <label className="block text-sm">
        Agent display name
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={config.identity?.agentName || "Amy"}
          onChange={(e) =>
            onChange({ identity: { ...config.identity, agentName: e.target.value } })
          }
        />
      </label>
    </div>
  );
}

function FollowUpStep({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>Recommended New Lead Follow-Up</CardTitle>
      <ul className="space-y-1 text-sm text-muted-foreground">
        <li>Immediately — Amy calls</li>
        <li>No answer — Send SMS</li>
        <li>2 hours later — Amy retries</li>
        <li>Next day — SMS / email</li>
        <li>Day 3 — Amy retries</li>
        <li>Day 7 — Follow-up</li>
      </ul>
      <Button variant={value ? "primary" : "outline"} onClick={() => onChange(true)}>
        Use recommended
      </Button>
    </div>
  );
}

function TestStep({ phoneE164 }: { phoneE164?: string }) {
  return (
    <div className="space-y-4">
      <CardTitle>Test Amy</CardTitle>
      <p className="text-sm">
        Call your Front Desk number{phoneE164 ? ` (${phoneE164})` : ""} or add a test lead on the Test Agent
        page after Go Live.
      </p>
      <Link href="/realtor/test" className="inline-flex h-9 items-center rounded-md border px-4 text-sm">
        Open Test Agent
      </Link>
    </div>
  );
}

function GoLiveStep({
  config,
  onGoLive,
}: {
  config: RealtorProductConfig;
  onGoLive: () => void;
}) {
  return (
    <div className="space-y-4">
      <CardTitle>Ready to go live</CardTitle>
      <ul className="space-y-2 text-sm">
        <li>✓ Front Desk — {config.amyMode !== "speed_to_lead" ? "Active on deploy" : "Off"}</li>
        <li>✓ Speed-to-Lead — {config.amyMode !== "front_desk" ? "Ready" : "Off"}</li>
        <li>✓ Calendar — Connected via Calendly integration</li>
        <li>✓ Agent + knowledge — Deployed automatically through code</li>
      </ul>
      <p className="text-sm text-muted-foreground">
        Go Live deploys your Real Estate Front Desk agent, seeds knowledge, and assigns your inbound number.
        No manual Coolify scripts required.
      </p>
      <Button onClick={onGoLive}>Go Live — Deploy Amy</Button>
    </div>
  );
}
