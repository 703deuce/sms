"use client";

import {
  SrBackLink,
  SrOutlineButton,
  SrPageShell,
  SrPrimaryButton,
  srCard,
} from "@/components/smart-routing/shared";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock,
  Grid3x3,
  Headphones,
  MessageSquare,
  Mic,
  Network,
  Phone,
  Radio,
  Sparkles,
  Upload,
  Users,
  Voicemail,
  Bot,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Template = {
  type: string;
  title: string;
  subtitle: string;
  bestFor: string[];
};

const TEMPLATE_ICONS: Record<string, { icon: typeof Grid3x3; color: string }> = {
  phone_menu: { icon: Grid3x3, color: "text-[#6366f1] bg-[#eef2ff]" },
  missed_call_recovery: { icon: MessageSquare, color: "text-emerald-600 bg-emerald-50" },
  after_hours: { icon: Clock, color: "text-amber-600 bg-amber-50" },
  department: { icon: Users, color: "text-sky-600 bg-sky-50" },
  custom: { icon: Network, color: "text-red-600 bg-red-50" },
};

const BUILDING_BLOCKS = [
  { label: "Greeting", icon: Radio, color: "text-[#6366f1] bg-[#eef2ff]" },
  { label: "Keypad Menu", icon: Grid3x3, color: "text-[#6366f1] bg-[#eef2ff]" },
  { label: "Ring Group", icon: Users, color: "text-emerald-600 bg-emerald-50" },
  { label: "Call Whisper", icon: Headphones, color: "text-orange-600 bg-orange-50" },
  { label: "Business Hours", icon: Clock, color: "text-amber-600 bg-amber-50" },
  { label: "Voicemail", icon: Voicemail, color: "text-sky-600 bg-sky-50" },
  { label: "AI Receptionist", icon: Bot, color: "text-[#6366f1] bg-[#eef2ff]" },
  { label: "Text Recovery", icon: MessageSquare, color: "text-emerald-600 bg-emerald-50" },
];

export function SmartRoutingNewFlowView({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("phone_menu");
  const [creating, setCreating] = useState(false);

  const mainTemplates = templates.filter((t) => t.type !== "custom");
  const customTemplate = templates.find((t) => t.type === "custom");

  async function continueFlow() {
    const template = templates.find((t) => t.type === selected);
    if (!template) return;
    setCreating(true);
    const res = await fetch("/api/smart-routing/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: template.type, name: template.title }),
    });
    const json = await res.json();
    if (json.data?.id) router.push(`/smart-routing/${json.data.id}`);
    setCreating(false);
  }

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <SrPageShell className="max-w-[1200px]">
        <SrBackLink />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-[#111827]">Create Call Flow</h1>
            <p className="mt-1 text-[14px] text-[#6b7280]">
              Start with a template and customize it for your business.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[12px] font-semibold text-[#6b7280]">Step 1 of 2</span>
              <div className="h-1.5 w-32 rounded-full bg-[#e5e7eb]">
                <div className="h-full w-1/2 rounded-full bg-[#6366f1]" />
              </div>
            </div>
          </div>
          <SrPrimaryButton
            disabled={!selected || creating}
            onClick={continueFlow}
            className="opacity-90"
          >
            Continue →
          </SrPrimaryButton>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <div>
              <h2 className="text-[15px] font-bold text-[#111827]">Choose a template</h2>
              <p className="mt-1 text-[12px] text-[#6b7280]">
                Start with a proven template and customize it to fit your business.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {mainTemplates.map((t) => {
                  const meta = TEMPLATE_ICONS[t.type] ?? TEMPLATE_ICONS.phone_menu;
                  const Icon = meta.icon;
                  const isSelected = selected === t.type;
                  return (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => setSelected(t.type)}
                      className={cn(
                        srCard,
                        "relative p-5 text-left transition-all",
                        isSelected
                          ? "border-[#6366f1] ring-2 ring-[#6366f1]/20"
                          : "hover:border-[#c7d2fe]",
                      )}
                    >
                      {isSelected ? (
                        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#6366f1] text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          meta.color,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <p className="mt-3 text-[14px] font-bold text-[#111827]">{t.title}</p>
                      <p className="mt-1 text-[12px] leading-snug text-[#6b7280]">{t.subtitle}</p>
                      <p className="mt-2 text-[11px] text-[#9ca3af]">
                        Best for: {t.bestFor.join(", ")}
                      </p>
                      <span className="mt-3 text-[12px] font-semibold text-[#6366f1]">
                        Use Template →
                      </span>
                    </button>
                  );
                })}
              </div>

              {customTemplate ? (
                <button
                  type="button"
                  onClick={() => setSelected(customTemplate.type)}
                  className={cn(
                    srCard,
                    "mt-4 w-full p-5 text-left",
                    selected === customTemplate.type
                      ? "border-[#6366f1] ring-2 ring-[#6366f1]/20"
                      : "",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                      <Network className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[14px] font-bold text-[#111827]">
                        {customTemplate.title}
                      </p>
                      <p className="mt-1 text-[12px] text-[#6b7280]">{customTemplate.subtitle}</p>
                      <p className="mt-2 text-[11px] text-[#9ca3af]">
                        Best for: {customTemplate.bestFor.join(", ")}
                      </p>
                    </div>
                  </div>
                </button>
              ) : null}
            </div>

            <div className={cn(srCard, "p-5")}>
              <h2 className="text-[15px] font-bold text-[#111827]">
                What this flow can include
              </h2>
              <p className="mt-1 text-[12px] text-[#6b7280]">
                Every Smart Routing flow can include these powerful building blocks.
              </p>
              <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
                {BUILDING_BLOCKS.map((b) => (
                  <div
                    key={b.label}
                    className="flex flex-col items-center gap-2 rounded-lg border border-[#e5e7eb] p-3 text-center"
                  >
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", b.color)}>
                      <b.icon className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-semibold text-[#374151]">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={cn(srCard, "p-5")}>
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-[#111827]">What happens next?</h2>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff]">
                  <Bot className="h-4 w-4 text-[#6366f1]" />
                </span>
              </div>
              <ol className="mt-4 space-y-4">
                {[
                  {
                    n: 1,
                    title: "Choose a template",
                    desc: "Start with a routing setup that fits your business.",
                    active: true,
                  },
                  {
                    n: 2,
                    title: "Customize your flow",
                    desc: "Add greetings, menu options, and routing destinations.",
                  },
                  {
                    n: 3,
                    title: "Test your call flow",
                    desc: "Call the number and make sure everything works.",
                  },
                  {
                    n: 4,
                    title: "Activate Smart Routing",
                    desc: "Publish your flow and start routing calls automatically.",
                  },
                ].map((step) => (
                  <li key={step.n} className="flex gap-3">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        step.active
                          ? "bg-[#6366f1] text-white"
                          : "bg-[#f3f4f6] text-[#6b7280]",
                      )}
                    >
                      {step.n}
                    </span>
                    <div>
                      <p
                        className={cn(
                          "text-[13px] font-semibold",
                          step.active ? "text-[#6366f1]" : "text-[#111827]",
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="text-[11px] text-[#6b7280]">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-5">
              <h3 className="text-[13px] font-bold text-[#111827]">Tips for a great experience</h3>
              <ul className="mt-3 space-y-2 text-[12px] text-[#374151]">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-[#6366f1]" /> Keep prompts short
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-[#6366f1]" /> Use clear menu labels
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-[#6366f1]" /> Always set a fallback path
                </li>
              </ul>
            </div>
          </div>
        </div>
      </SrPageShell>

      <div className="sticky bottom-0 border-t border-[#e5e7eb] bg-white px-6 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <Link href="/smart-routing">
            <SrOutlineButton>Cancel</SrOutlineButton>
          </Link>
          <SrPrimaryButton disabled={!selected || creating} onClick={continueFlow}>
            Continue →
          </SrPrimaryButton>
        </div>
      </div>
    </div>
  );
}
