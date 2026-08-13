"use client";

import { Input } from "@/components/ui/input";
import type { ReceptionistAdvancedSettings } from "@/lib/receptionist-wizard/advanced-types";
import { addCustomCallerField } from "@/lib/receptionist-wizard/caller-field-editor";
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
  CapabilityCardCompact,
  FieldChip,
  SetupDetailsPanel,
  TimingOptionRow,
  WizardFooter,
  WizardPageHeader,
  WizardPageLayout,
  WizardQuestionBlock,
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
    iconBg: "bg-[#6366f1]/10",
    iconColor: "text-[#6366f1]",
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
    iconBg: "bg-[#6366f1]/10",
    iconColor: "text-[#6366f1]",
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
  const [customLabel, setCustomLabel] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
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

  function addCustomField() {
    const next = addCustomCallerField(advanced.callerFields, {
      label: customLabel,
      question: customQuestion,
      required: false,
      askWhen: "service_inquiry",
    });
    if (next.length === advanced.callerFields.length) return;
    patchAdvanced({ callerFields: next });
    setCustomLabel("");
    setCustomQuestion("");
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
    <WizardPageLayout
      wideAside
      aside={
        <SetupDetailsPanel
          agent={agent}
          businessName={state.businessName}
          capabilities={state.capabilities}
          capabilityOptions={CAPABILITY_OPTIONS}
          enabledFieldLabels={enabledFields.map((f) => f.label)}
          answerLabel={
            ANSWER_TIMING_OPTIONS.find((o) => o.id === state.answerTiming)?.label || "Every call"
          }
        />
      }
    >
      <WizardPageHeader
        icon={<Bot className="h-5 w-5 text-[#6366f1]" />}
        title="What it should do"
        subtitle="Choose capabilities, routing, and what information to collect."
      />

      <WizardQuestionBlock number={1} title="What can you do?">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {CAPABILITY_OPTIONS.map((cap) => {
            const meta = CAPABILITY_ICONS[cap.id];
            const Icon = meta.icon;
            return (
              <CapabilityCardCompact
                key={cap.id}
                selected={state.capabilities.includes(cap.id)}
                onClick={() => toggleCap(cap.id)}
                icon={<Icon className="h-5 w-5" />}
                iconBg={meta.iconBg}
                iconColor={meta.iconColor}
                title={cap.label}
              />
            );
          })}
        </div>
      </WizardQuestionBlock>

      <div className="mt-4">
        <WizardQuestionBlock number={2} title="How would they answer?">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ANSWER_TIMING_OPTIONS.map((opt) => {
              const Icon = TIMING_ICONS[opt.id] || PhoneForwarded;
              return (
                <TimingOptionRow
                  key={opt.id}
                  selected={state.answerTiming === opt.id}
                  onClick={() => patch({ answerTiming: opt.id })}
                  icon={<Icon className="h-4 w-4" />}
                  title={opt.label}
                  description={opt.description}
                />
              );
            })}
          </div>
        </WizardQuestionBlock>
      </div>

      {showCollect ? (
        <div className="mt-4">
          <WizardQuestionBlock number={3} title="What information should they collect?">
              <div className="grid gap-2 sm:grid-cols-2">
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
              <div className="mt-4 rounded-lg border border-[#e6e8ef] bg-[#f8f9fc] p-4">
                <p className="text-xs font-semibold text-[#374151]">Add custom field</p>
                <p className="mt-1 text-[11px] text-[#6b7280]">
                  For details beyond name, phone, and reason — e.g. system type, gate code, property type.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Field label (e.g. System type)"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="Question to ask (optional)"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={addCustomField}
                  disabled={!customLabel.trim()}
                  className="mt-3 text-xs font-semibold text-[#6366f1] disabled:text-[#9ca3af]"
                >
                  + Add field
                </button>
              </div>
            </WizardQuestionBlock>
          </div>
        ) : null}

      {bookAppts ? (
        <div className="mt-5 voice-card p-5">
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
          <div className="mt-5 voice-card p-5">
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
          <div className="mt-5 voice-card p-5">
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
          <div className="mt-5 voice-card p-5">
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

        <div className="mt-5 voice-card p-5">
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
                href="/voice/knowledge"
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
    </WizardPageLayout>
  );
}
