"use client";

import { Input } from "@/components/ui/input";
import type { ReceptionistAdvancedSettings } from "@/lib/receptionist-wizard/advanced-types";
import {
  ANSWER_TIMING_OPTIONS,
  CAPABILITY_OPTIONS,
  type CapabilityId,
  type ReceptionistWizardState,
} from "@/lib/receptionist-wizard/types";
import {
  Bot,
  Calendar,
  Clock,
  FileText,
  MessageCircle,
  MessageSquare,
  Phone,
  PhoneForwarded,
  PhoneMissed,
  Upload,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ReceptionistIntegrationsPanel } from "../receptionist-integrations-panel";
import {
  CapabilityCard,
  FieldChip,
  SelectableCard,
  SidePanel,
  WizardFooter,
  WizardSection,
} from "../ui";

const TIMING_ICONS = {
  every_call: Phone,
  after_hours: Clock,
  nobody_answers: PhoneMissed,
  overflow: Users,
} as const;

const CAPABILITY_ICONS: Record<
  CapabilityId,
  { icon: LucideIcon; iconBg: string; iconColor: string }
> = {
  answer_questions: {
    icon: MessageCircle,
    iconBg: "bg-[#3b82f6]/10",
    iconColor: "text-[#3b82f6]",
  },
  take_messages: {
    icon: FileText,
    iconBg: "bg-[#f59e0b]/10",
    iconColor: "text-[#f59e0b]",
  },
  collect_info: {
    icon: User,
    iconBg: "bg-[#8b5cf6]/10",
    iconColor: "text-[#8b5cf6]",
  },
  book_appointments: {
    icon: Calendar,
    iconBg: "bg-[#10b981]/10",
    iconColor: "text-[#10b981]",
  },
  transfer_calls: {
    icon: PhoneForwarded,
    iconBg: "bg-[#6366f1]/10",
    iconColor: "text-[#6366f1]",
  },
  send_text: {
    icon: MessageSquare,
    iconBg: "bg-[#06b6d4]/10",
    iconColor: "text-[#06b6d4]",
  },
};

export function CapabilitiesStep({
  state,
  advanced,
  patch,
  patchAdvanced,
  onBack,
  onContinue,
  busy,
}: {
  state: ReceptionistWizardState;
  advanced: ReceptionistAdvancedSettings;
  patch: (p: Partial<ReceptionistWizardState>) => void;
  patchAdvanced: (p: Partial<ReceptionistAdvancedSettings>) => void;
  onBack: () => void;
  onContinue: () => void;
  busy?: boolean;
}) {
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [integrationError, setIntegrationError] = useState("");
  const agent = state.agentName.trim() || "Amy";

  function toggleCap(id: CapabilityId) {
    const has = state.capabilities.includes(id);
    patch({
      capabilities: has ? state.capabilities.filter((c) => c !== id) : [...state.capabilities, id],
    });
  }

  function toggleField(id: string) {
    const rows = advanced.callerFields.map((row) =>
      row.id === id ? { ...row, enabled: !row.enabled } : row,
    );
    patchAdvanced({ callerFields: rows });
  }

  const collectInfo = state.capabilities.includes("collect_info");
  const takeMessages = state.capabilities.includes("take_messages");
  const bookAppts = state.capabilities.includes("book_appointments");
  const transferCalls = state.capabilities.includes("transfer_calls");
  const sendText = state.capabilities.includes("send_text");
  const showCollect =
    collectInfo || takeMessages || bookAppts;

  const enabledFields = advanced.callerFields.filter((f) => f.enabled);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#6366f1]/10">
            <Bot className="h-6 w-6 text-[#6366f1]" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
              What {agent} Should Do
            </h1>
            <p className="mt-1 text-sm text-[#6b7280]">
              Choose capabilities, routing, and what information to collect.
            </p>
          </div>
        </div>

        <WizardSection number={1} title={`What can ${agent} do?`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITY_OPTIONS.map((cap) => {
              const meta = CAPABILITY_ICONS[cap.id];
              const Icon = meta.icon;
              return (
                <CapabilityCard
                  key={cap.id}
                  selected={state.capabilities.includes(cap.id)}
                  onClick={() => toggleCap(cap.id)}
                  icon={<Icon className="h-5 w-5" />}
                  iconBg={meta.iconBg}
                  iconColor={meta.iconColor}
                  title={cap.label}
                  description={cap.description}
                />
              );
            })}
          </div>
        </WizardSection>

        <div className="mt-6">
          <WizardSection number={2} title={`When should ${agent} answer?`}>
            <div className="grid gap-3 sm:grid-cols-2">
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
          </WizardSection>
        </div>

        {showCollect ? (
          <div className="mt-6">
            <WizardSection number={3} title="Information to collect">
              <div className="flex flex-wrap gap-2">
                {advanced.callerFields.map((field) => (
                  <FieldChip
                    key={field.id}
                    label={field.label}
                    selected={field.enabled}
                    required={field.required}
                    onToggle={() => toggleField(field.id)}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-[#6b7280]">
                Callers can provide information early — you don&apos;t need to configure that behavior.
              </p>
            </WizardSection>
          </div>
        ) : null}

        {bookAppts ? (
          <div className="mt-6 voice-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <Calendar className="h-4 w-4 text-[#6366f1]" />
              Appointment Booking
            </div>
            {integrationError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {integrationError}
              </p>
            ) : null}
            <div className="mt-4">
              <ReceptionistIntegrationsPanel
                agentId={state.agentId}
                showCalendar={true}
                showCrm={false}
                onCalendarConnectedChange={setCalendarConnected}
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[#374151]">Appointment length</label>
                <select
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#e6e8ef] px-3 text-sm"
                  value={advanced.bookingPolicy.minimumNoticeHours}
                  onChange={(e) =>
                    patchAdvanced({
                      bookingPolicy: {
                        ...advanced.bookingPolicy,
                        minimumNoticeHours: Number(e.target.value),
                      },
                    })
                  }
                >
                  <option value={1}>60 minutes</option>
                  <option value={2}>2 hours notice</option>
                  <option value={4}>4 hours notice</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#374151]">How far ahead</label>
                <select className="mt-1.5 h-10 w-full rounded-lg border border-[#e6e8ef] px-3 text-sm">
                  <option>30 days</option>
                  <option>14 days</option>
                  <option>7 days</option>
                </select>
              </div>
            </div>
          </div>
        ) : null}

        {transferCalls ? (
          <div className="mt-6 voice-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <PhoneForwarded className="h-4 w-4 text-[#6366f1]" />
              Call Transfers
            </div>
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Transfer destination (+1...)"
                value={advanced.transferPolicy.destinationE164}
                onChange={(e) =>
                  patchAdvanced({
                    transferPolicy: {
                      ...advanced.transferPolicy,
                      destinationE164: e.target.value,
                    },
                  })
                }
              />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#374151]">When should {agent} transfer?</p>
                {[
                  { id: "caller_asks" as const, label: "Whenever the caller asks for a person" },
                  { id: "certain_calls" as const, label: "Only for certain calls" },
                  { id: "instructions" as const, label: "Use my instructions" },
                ].map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="radio"
                      checked={advanced.transferPolicy.whenToTransfer === opt.id}
                      onChange={() =>
                        patchAdvanced({
                          transferPolicy: { ...advanced.transferPolicy, whenToTransfer: opt.id },
                        })
                      }
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              {advanced.transferPolicy.whenToTransfer === "certain_calls" ? (
                <textarea
                  className="min-h-[72px] w-full rounded-lg border border-[#e6e8ef] p-3 text-sm"
                  placeholder="Emergency service calls, existing customers with active jobs, billing problems."
                  value={advanced.transferPolicy.transferInstructions || ""}
                  onChange={(e) =>
                    patchAdvanced({
                      transferPolicy: {
                        ...advanced.transferPolicy,
                        transferInstructions: e.target.value,
                      },
                    })
                  }
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {takeMessages ? (
          <div className="mt-6 voice-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <MessageSquare className="h-4 w-4 text-[#6366f1]" />
              When {agent} Takes a Message
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[#374151]">Send to Email</label>
                <Input
                  className="mt-1.5"
                  placeholder="office@example.com"
                  value={advanced.notifications.messageEmail || ""}
                  onChange={(e) =>
                    patchAdvanced({
                      notifications: { ...advanced.notifications, messageEmail: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#374151]">Send to SMS</label>
                <Input
                  className="mt-1.5"
                  placeholder="(703) 555-0198"
                  value={advanced.notifications.messageSms || ""}
                  onChange={(e) =>
                    patchAdvanced({
                      notifications: { ...advanced.notifications, messageSms: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          </div>
        ) : null}

        {sendText ? (
          <div className="mt-6 voice-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <MessageSquare className="h-4 w-4 text-[#6366f1]" />
              Text Messages
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Appointment confirmation", "Business information", "Follow-up message"].map(
                (label) => (
                  <FieldChip key={label} label={label} selected={label === "Appointment confirmation"} />
                ),
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-6 voice-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <Upload className="h-4 w-4 text-[#6366f1]" />
            Give {agent} More Knowledge
          </div>
          <p className="mt-2 text-xs text-[#6b7280]">
            Best for FAQs, warranties, policies, price books, and manuals — not basic business info from
            Page 1.
          </p>
          <div className="mt-4 rounded-xl border-2 border-dashed border-[#e6e8ef] bg-[#f8f9fc] p-8 text-center">
            <Upload className="mx-auto h-8 w-8 text-[#9ca3af]" />
            <p className="mt-2 text-sm font-medium text-[#374151]">Drop files here</p>
            <p className="text-xs text-[#9ca3af]">PDF · DOCX · TXT</p>
            {state.agentId ? (
              <Link
                href={`/voice/agents/${state.agentId}/integrations`}
                className="mt-3 inline-block text-xs font-medium text-[#6366f1] hover:underline"
              >
                Upload files →
              </Link>
            ) : null}
          </div>
        </div>

        <WizardFooter
          showBack
          onBack={onBack}
          onContinue={() => {
            if (bookAppts && !calendarConnected) {
              setIntegrationError(
                "Connect Calendly or Google / Outlook before continuing — booking needs a live calendar.",
              );
              return;
            }
            setIntegrationError("");
            onContinue();
          }}
          busy={busy}
        />
      </div>

      <SidePanel title={`${agent}'s Setup`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366f1] text-sm font-bold text-white">
            {agent.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-[#111827]">{agent}</p>
            <p className="text-xs text-[#6b7280]">{state.businessName || "Your business"}</p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm">
          {CAPABILITY_OPTIONS.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-[#374151]">
              <span className={state.capabilities.includes(c.id) ? "text-[#6366f1]" : "text-[#d1d5db]"}>
                {state.capabilities.includes(c.id) ? "✓" : "—"}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
        {enabledFields.length ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">Collecting</p>
            <p className="mt-1 text-sm text-[#374151]">
              {enabledFields.map((f) => f.label).join(" · ")}
            </p>
          </div>
        ) : null}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">Answering</p>
          <p className="mt-1 text-sm text-[#374151]">
            {ANSWER_TIMING_OPTIONS.find((o) => o.id === state.answerTiming)?.label || "Every call"}
          </p>
        </div>
        <div className="mt-4 rounded-lg bg-[#6366f1]/5 p-3 text-xs text-[#6b7280]">
          Capabilities control what tools the runtime exposes — prompt text cannot bypass disabled actions.
        </div>
      </SidePanel>
    </div>
  );
}
