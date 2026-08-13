"use client";

import { Input } from "@/components/ui/input";
import type { CapabilityId } from "@/lib/receptionist-wizard/types";
import type {
  AskWhenMode,
  DecisionRuleRow,
  ReceptionistAdvancedSettings,
} from "@/lib/receptionist-wizard/advanced-types";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

function Section({
  title,
  description,
  defaultOpen,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="voice-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? <div className="border-t border-border px-5 pb-5 pt-4">{children}</div> : null}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border text-primary"
      />
    </label>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              value === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const ASK_WHEN_OPTIONS: Array<{ value: AskWhenMode; label: string }> = [
  { value: "every_caller", label: "Every caller" },
  { value: "new_callers", label: "New callers" },
  { value: "when_booking", label: "When booking" },
  { value: "service_inquiry", label: "Service inquiry" },
];

export function AgentAdvancedSettings({
  value,
  onChange,
  capabilities,
  agentId,
  onSave,
  onDiscard,
  busy,
  agentDisplayName = "Amy",
}: {
  value: ReceptionistAdvancedSettings;
  onChange: (next: ReceptionistAdvancedSettings) => void;
  capabilities: CapabilityId[];
  agentId?: string;
  onSave: () => void;
  onDiscard: () => void;
  busy?: boolean;
  agentDisplayName?: string;
}) {
  const patch = (partial: Partial<ReceptionistAdvancedSettings>) => {
    onChange({ ...value, ...partial });
  };

  const patchConv = (partial: Partial<ReceptionistAdvancedSettings["conversationBehavior"]>) => {
    onChange({
      ...value,
      conversationBehavior: { ...value.conversationBehavior, ...partial },
    });
  };

  const patchBooking = (partial: Partial<ReceptionistAdvancedSettings["bookingPolicy"]>) => {
    onChange({ ...value, bookingPolicy: { ...value.bookingPolicy, ...partial } });
  };

  const patchTransfer = (partial: Partial<ReceptionistAdvancedSettings["transferPolicy"]>) => {
    onChange({ ...value, transferPolicy: { ...value.transferPolicy, ...partial } });
  };

  const patchKnowledge = (partial: Partial<ReceptionistAdvancedSettings["knowledgePolicy"]>) => {
    onChange({ ...value, knowledgePolicy: { ...value.knowledgePolicy, ...partial } });
  };

  const patchActions = (partial: Partial<ReceptionistAdvancedSettings["actionPermissions"]>) => {
    onChange({ ...value, actionPermissions: { ...value.actionPermissions, ...partial } });
  };

  const patchFallback = (partial: Partial<ReceptionistAdvancedSettings["fallbackPolicy"]>) => {
    onChange({ ...value, fallbackPolicy: { ...value.fallbackPolicy, ...partial } });
  };

  const patchNotifications = (partial: Partial<ReceptionistAdvancedSettings["notifications"]>) => {
    onChange({ ...value, notifications: { ...value.notifications, ...partial } });
  };

  const bookEnabled = capabilities.includes("book_appointments");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Advanced Settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Fine-tune how {agentDisplayName} handles conversations, information, decisions, and
          actions. Defaults work for most businesses — change only what you need.
        </p>
      </div>

      <div className="space-y-3">
        <Section title="Conversation Behavior" defaultOpen>
          <Segmented
            label="Response length"
            value={value.conversationBehavior.responseLength}
            onChange={(v) => patchConv({ responseLength: v })}
            options={[
              { value: "concise", label: "Concise" },
              { value: "balanced", label: "Balanced" },
              { value: "detailed", label: "Detailed" },
            ]}
          />
          <Segmented
            label="Conversation style"
            value={value.conversationBehavior.style}
            onChange={(v) => patchConv({ style: v })}
            options={[
              { value: "friendly", label: "Friendly" },
              { value: "professional", label: "Professional" },
              { value: "casual", label: "Casual" },
            ]}
          />
          <ToggleRow
            label="Let callers interrupt"
            checked={value.conversationBehavior.allowInterrupt}
            onChange={(v) => patchConv({ allowInterrupt: v })}
          />
          <ToggleRow
            label="Confirm important details"
            checked={value.conversationBehavior.confirmImportantDetails}
            onChange={(v) => patchConv({ confirmImportantDetails: v })}
          />
          <ToggleRow
            label="Repeat information when uncertain"
            checked={value.conversationBehavior.repeatWhenUncertain}
            onChange={(v) => patchConv({ repeatWhenUncertain: v })}
          />
          <ToggleRow
            label="Avoid asking the same question twice"
            checked={value.conversationBehavior.avoidDuplicateQuestions}
            onChange={(v) => patchConv({ avoidDuplicateQuestions: v })}
          />
          <ToggleRow
            label="Handle answers given out of order"
            checked={value.conversationBehavior.handleOutOfOrderAnswers}
            onChange={(v) => patchConv({ handleOutOfOrderAnswers: v })}
          />
          <ToggleRow
            label="Allow natural acknowledgments between questions"
            checked={value.conversationBehavior.allowAcknowledgments}
            onChange={(v) => patchConv({ allowAcknowledgments: v })}
          />
          <Segmented
            label="Filler / transition speech"
            value={value.conversationBehavior.fillerSpeech}
            onChange={(v) => patchConv({ fillerSpeech: v })}
            options={[
              { value: "minimal", label: "Minimal" },
              { value: "natural", label: "Natural" },
              { value: "off", label: "Off" },
            ]}
          />
          <div className="mt-3">
            <label className="text-sm font-medium">Maximum silence before prompting again</label>
            <select
              className="mt-1.5 h-10 w-full max-w-xs rounded-lg border border-border bg-card px-3 text-sm"
              value={value.conversationBehavior.silenceRepromptSec}
              onChange={(e) =>
                patchConv({ silenceRepromptSec: Number(e.target.value) as 3 | 5 | 8 })
              }
            >
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={8}>8 seconds</option>
            </select>
          </div>
        </Section>

        <Section title="Caller Information & Questions">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2">Information</th>
                <th className="pb-2">Collect</th>
                <th className="pb-2">Required</th>
                <th className="pb-2">Ask when</th>
                <th className="pb-2">Confirm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {value.callerFields.map((field, idx) => (
                <tr key={field.id}>
                  <td className="py-2.5 font-medium">{field.label}</td>
                  <td className="py-2.5">
                    <input
                      type="checkbox"
                      checked={field.enabled}
                      onChange={(e) => {
                        const next = [...value.callerFields];
                        next[idx] = { ...field, enabled: e.target.checked };
                        patch({ callerFields: next });
                      }}
                    />
                  </td>
                  <td className="py-2.5">
                    <input
                      type="checkbox"
                      checked={field.required}
                      disabled={!field.enabled}
                      onChange={(e) => {
                        const next = [...value.callerFields];
                        next[idx] = { ...field, required: e.target.checked };
                        patch({ callerFields: next });
                      }}
                    />
                  </td>
                  <td className="py-2.5">
                    <select
                      className="rounded border border-border bg-card px-2 py-1 text-xs"
                      value={field.askWhen}
                      disabled={!field.enabled}
                      onChange={(e) => {
                        const next = [...value.callerFields];
                        next[idx] = {
                          ...field,
                          askWhen: e.target.value as AskWhenMode,
                        };
                        patch({ callerFields: next });
                      }}
                    >
                      {ASK_WHEN_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <input
                      type="checkbox"
                      checked={field.confirm}
                      disabled={!field.enabled}
                      onChange={(e) => {
                        const next = [...value.callerFields];
                        next[idx] = { ...field, confirm: e.target.checked };
                        patch({ callerFields: next });
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Call Types / Intent Handling">
          <div className="space-y-2 text-sm">
            {value.intents.map((intent, idx) => (
              <label
                key={intent.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
              >
                <span className="font-medium">{intent.label}</span>
                <input
                  type="checkbox"
                  checked={intent.enabled}
                  onChange={(e) => {
                    const next = [...value.intents];
                    next[idx] = { ...intent, enabled: e.target.checked };
                    patch({ intents: next });
                  }}
                />
              </label>
            ))}
          </div>
        </Section>

        <Section title="Decision Rules">
          <div className="space-y-3 text-sm">
            {value.decisionRules.map((rule, idx) => (
              <div key={rule.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <Input
                  value={rule.condition}
                  onChange={(e) => {
                    const next = [...value.decisionRules];
                    next[idx] = { ...rule, condition: e.target.value };
                    patch({ decisionRules: next });
                  }}
                  placeholder="IF condition"
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Input
                    value={rule.action}
                    onChange={(e) => {
                      const next = [...value.decisionRules];
                      next[idx] = { ...rule, action: e.target.value };
                      patch({ decisionRules: next });
                    }}
                    placeholder="Action (transfer, message, …)"
                    className="text-sm"
                  />
                  <Input
                    value={rule.target || ""}
                    onChange={(e) => {
                      const next = [...value.decisionRules];
                      next[idx] = { ...rule, target: e.target.value };
                      patch({ decisionRules: next });
                    }}
                    placeholder="Target"
                    className="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 voice-btn-outline text-xs"
            onClick={() =>
              patch({
                decisionRules: [
                  ...value.decisionRules,
                  {
                    id: `rule_${Date.now()}`,
                    condition: "",
                    action: "take_message",
                    target: "",
                  },
                ],
              })
            }
          >
            + Add Rule
          </button>
        </Section>

        <Section title="Booking Rules">
          <ToggleRow
            label="Ask preferred day first"
            checked={value.bookingPolicy.askPreferredDayFirst}
            onChange={(v) => patchBooking({ askPreferredDayFirst: v })}
            disabled={!bookEnabled}
          />
          <ToggleRow
            label="Offer earliest availability"
            checked={value.bookingPolicy.offerEarliestAvailability}
            onChange={(v) => patchBooking({ offerEarliestAvailability: v })}
            disabled={!bookEnabled}
          />
          <ToggleRow
            label="Confirm date/time verbally"
            checked={value.bookingPolicy.confirmDateTimeVerbally}
            onChange={(v) => patchBooking({ confirmDateTimeVerbally: v })}
            disabled={!bookEnabled}
          />
          <ToggleRow
            label="Send SMS confirmation after booking"
            checked={value.bookingPolicy.sendSmsConfirmation}
            onChange={(v) => patchBooking({ sendSmsConfirmation: v })}
            disabled={!bookEnabled}
          />
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Slots to offer</label>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-sm"
                value={value.bookingPolicy.slotsToOffer}
                disabled={!bookEnabled}
                onChange={(e) => patchBooking({ slotsToOffer: Number(e.target.value) })}
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Minimum notice</label>
              <select
                className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-sm"
                value={value.bookingPolicy.minimumNoticeHours}
                disabled={!bookEnabled}
                onChange={(e) => patchBooking({ minimumNoticeHours: Number(e.target.value) })}
              >
                <option value={2}>2 hours</option>
                <option value={24}>24 hours</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Transfer & Escalation Rules">
          <ToggleRow
            label="Warm transfer when possible"
            checked={value.transferPolicy.warmTransfer}
            onChange={(v) => patchTransfer({ warmTransfer: v })}
          />
          <ToggleRow
            label="Take message if transfer fails"
            checked={value.transferPolicy.takeMessageOnFailure}
            onChange={(v) => patchTransfer({ takeMessageOnFailure: v })}
          />
          <ToggleRow
            label="Notify owner on failed transfer"
            checked={value.transferPolicy.notifyOnFailure}
            onChange={(v) => patchTransfer({ notifyOnFailure: v })}
          />
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Transfer destination (E.164)
              </label>
              <Input
                className="mt-1"
                placeholder="+15551234567"
                value={value.transferPolicy.destinationE164}
                onChange={(e) => patchTransfer({ destinationE164: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Emergency line (E.164)
              </label>
              <Input
                className="mt-1"
                placeholder="+15559110000"
                value={value.transferPolicy.emergencyDestinationE164}
                onChange={(e) => patchTransfer({ emergencyDestinationE164: e.target.value })}
              />
            </div>
          </div>
        </Section>

        <Section title="Knowledge Behavior">
          <ToggleRow
            label="Answer only from approved knowledge"
            checked={value.knowledgePolicy.approvedKnowledgeOnly}
            onChange={(v) => patchKnowledge({ approvedKnowledgeOnly: v })}
          />
          <ToggleRow
            label="Allow general business answers"
            checked={value.knowledgePolicy.allowGeneralAnswers}
            onChange={(v) => patchKnowledge({ allowGeneralAnswers: v })}
          />
          <div className="mt-2">
            <label className="text-sm font-medium">If uncertain</label>
            <select
              className="mt-1.5 h-10 w-full max-w-xs rounded-lg border border-border bg-card px-3 text-sm"
              value={value.knowledgePolicy.whenUncertain}
              onChange={(e) =>
                patchKnowledge({
                  whenUncertain: e.target.value as ReceptionistAdvancedSettings["knowledgePolicy"]["whenUncertain"],
                })
              }
            >
              <option value="take_message">Take a message</option>
              <option value="say_unknown">Say she doesn&apos;t know</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
        </Section>

        <Section title="Actions & Permissions">
          <ToggleRow
            label="Take messages"
            checked={value.actionPermissions.takeMessages}
            onChange={(v) => patchActions({ takeMessages: v })}
            disabled={!capabilities.includes("take_messages")}
          />
          <ToggleRow
            label="Update contact information"
            checked={value.actionPermissions.updateContact}
            onChange={(v) => patchActions({ updateContact: v })}
          />
          <ToggleRow
            label="Send SMS"
            checked={value.actionPermissions.sendSms}
            onChange={(v) => patchActions({ sendSms: v })}
            disabled={!capabilities.includes("send_text")}
          />
          <ToggleRow
            label="Book appointments"
            checked={value.actionPermissions.bookAppointments}
            onChange={(v) => patchActions({ bookAppointments: v })}
            disabled={!bookEnabled}
          />
          <ToggleRow
            label="Transfer calls"
            checked={value.actionPermissions.transferCalls}
            onChange={(v) => patchActions({ transferCalls: v })}
            disabled={!capabilities.includes("transfer_calls")}
          />
          <ToggleRow
            label="Cancel appointments"
            checked={value.actionPermissions.cancelAppointments}
            onChange={(v) => patchActions({ cancelAppointments: v })}
            disabled={!bookEnabled}
          />
          <ToggleRow
            label="Reschedule appointments"
            checked={value.actionPermissions.rescheduleAppointments}
            onChange={(v) => patchActions({ rescheduleAppointments: v })}
            disabled={!bookEnabled}
          />
        </Section>

        <Section title="Fallback & Failure Handling">
          <div className="space-y-3 text-sm">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Max misunderstand attempts
              </label>
              <select
                className="mt-1 h-9 w-full max-w-xs rounded-lg border border-border px-2 text-sm"
                value={value.fallbackPolicy.maxMisunderstandAttempts}
                onChange={(e) =>
                  patchFallback({ maxMisunderstandAttempts: Number(e.target.value) })
                }
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">If cannot understand</label>
              <select
                className="mt-1 h-9 w-full max-w-xs rounded-lg border border-border px-2 text-sm"
                value={value.fallbackPolicy.onMisunderstand}
                onChange={(e) =>
                  patchFallback({
                    onMisunderstand: e.target.value as ReceptionistAdvancedSettings["fallbackPolicy"]["onMisunderstand"],
                  })
                }
              >
                <option value="take_message">Take a message</option>
                <option value="transfer">Offer transfer</option>
                <option value="repeat">Repeat question</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">If booking fails</label>
              <select
                className="mt-1 h-9 w-full max-w-xs rounded-lg border border-border px-2 text-sm"
                value={value.fallbackPolicy.onBookingFail}
                onChange={(e) =>
                  patchFallback({
                    onBookingFail: e.target.value as ReceptionistAdvancedSettings["fallbackPolicy"]["onBookingFail"],
                  })
                }
              >
                <option value="follow_up">Someone will follow up</option>
                <option value="take_message">Take a message</option>
                <option value="retry">Retry booking</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">If transfer fails</label>
              <select
                className="mt-1 h-9 w-full max-w-xs rounded-lg border border-border px-2 text-sm"
                value={value.fallbackPolicy.onTransferFail}
                onChange={(e) =>
                  patchFallback({
                    onTransferFail: e.target.value as ReceptionistAdvancedSettings["fallbackPolicy"]["onTransferFail"],
                  })
                }
              >
                <option value="take_message">Take a message</option>
                <option value="retry">Retry transfer</option>
                <option value="end_call">End call politely</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Notifications & Results">
          <ToggleRow
            label="Send call summary"
            checked={value.notifications.sendCallSummary}
            onChange={(v) => patchNotifications({ sendCallSummary: v })}
          />
          <ToggleRow
            label="Notify me for urgent calls"
            checked={value.notifications.notifyUrgent}
            onChange={(v) => patchNotifications({ notifyUrgent: v })}
          />
          <ToggleRow
            label="Notify me for new customers"
            checked={value.notifications.notifyNewCustomers}
            onChange={(v) => patchNotifications({ notifyNewCustomers: v })}
          />
          <ToggleRow
            label="Notify me when a transfer fails"
            checked={value.notifications.notifyTransferFail}
            onChange={(v) => patchNotifications({ notifyTransferFail: v })}
          />
          <Segmented
            label="Summary detail"
            value={value.notifications.summaryDetail}
            onChange={(v) => patchNotifications({ summaryDetail: v })}
            options={[
              { value: "short", label: "Short" },
              { value: "standard", label: "Standard" },
              { value: "detailed", label: "Detailed" },
            ]}
          />
        </Section>

        <Section title="Developer / Expert">
          <p className="text-sm text-muted-foreground">
            Webhooks, API actions, custom tools, and workspace integrations.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/integrations" className="voice-btn-outline text-xs">
              All integrations
            </Link>
            {agentId ? (
              <Link href={`/voice/agents/${agentId}/integrations`} className="voice-btn-outline text-xs">
                Agent integrations
              </Link>
            ) : null}
          </div>
        </Section>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-6">
        <button type="button" className="voice-btn-outline" onClick={onDiscard} disabled={busy}>
          Discard
        </button>
        <button type="button" className="voice-btn-primary" onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
