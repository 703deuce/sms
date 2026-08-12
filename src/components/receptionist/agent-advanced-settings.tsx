"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
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

function ToggleRow({ label, defaultOn = true }: { label: string; defaultOn?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm">
      <span>{label}</span>
      <input type="checkbox" defaultChecked={defaultOn} className="h-4 w-4 rounded border-border text-primary" />
    </label>
  );
}

function Segmented({
  label,
  options,
  defaultValue,
}: {
  label: string;
  options: string[];
  defaultValue?: string;
}) {
  return (
    <div className="py-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
              opt === defaultValue
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/40",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgentAdvancedSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Advanced Settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Fine-tune how Amy handles conversations, information, decisions, and actions. Most
          businesses can leave these settings at their defaults.
        </p>
      </div>

      <div className="space-y-3">
        <Section title="Conversation Behavior" defaultOpen>
          <Segmented label="Response length" options={["Concise", "Balanced", "Detailed"]} defaultValue="Balanced" />
          <Segmented label="Conversation style" options={["Friendly", "Professional", "Casual"]} defaultValue="Professional" />
          <ToggleRow label="Let callers interrupt" />
          <ToggleRow label="Confirm important details" />
          <ToggleRow label="Repeat information when uncertain" />
          <ToggleRow label="Avoid asking the same question twice" />
          <ToggleRow label="Handle answers given out of order" />
          <ToggleRow label="Allow natural acknowledgments between questions" />
          <Segmented label="Filler / transition speech" options={["Minimal", "Natural", "Off"]} defaultValue="Natural" />
          <div className="mt-3">
            <label className="text-sm font-medium">Maximum silence before Amy prompts caller again</label>
            <select className="mt-1.5 h-10 w-full max-w-xs rounded-lg border border-border bg-card px-3 text-sm">
              <option>3 seconds</option>
              <option>5 seconds</option>
              <option>8 seconds</option>
            </select>
          </div>
        </Section>

        <Section title="Caller Information & Questions">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-2">Information</th>
                <th className="pb-2">Required</th>
                <th className="pb-2">Ask when</th>
                <th className="pb-2">Confirm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Name", "Yes", "Every caller", "No"],
                ["Phone", "Yes", "New callers", "Yes"],
                ["Email", "No", "When booking", "Yes"],
                ["Reason for calling", "Yes", "Every caller", "No"],
                ["Service address", "No", "Service inquiry", "Yes"],
              ].map(([info, req, when, confirm]) => (
                <tr key={info}>
                  <td className="py-2.5 font-medium">{info}</td>
                  <td className="py-2.5 text-muted-foreground">{req}</td>
                  <td className="py-2.5 text-muted-foreground">{when}</td>
                  <td className="py-2.5 text-muted-foreground">{confirm}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="mt-4 voice-btn-outline voice-btn-outline-purple text-xs">
            + Add custom question
          </button>
        </Section>

        <Section title="Call Types / Intent Handling">
          <div className="space-y-2 text-sm">
            {[
              "New Customer",
              "Existing Customer",
              "Sales Inquiry",
              "Appointment Request",
              "Billing Question",
              "Emergency",
              "Vendor / Solicitor",
              "Other",
            ].map((intent) => (
              <div
                key={intent}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
              >
                <span className="font-medium">{intent}</span>
                <button type="button" className="text-xs font-medium text-primary">Edit</button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Decision Rules">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <span className="font-medium">IF</span> Caller is an emergency{" "}
              <span className="font-medium">THEN</span> Transfer call{" "}
              <span className="font-medium">TO</span> Emergency Line
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <span className="font-medium">IF</span> Caller asks for a human{" "}
              <span className="font-medium">THEN</span> Transfer to Main Office
            </div>
          </div>
          <button type="button" className="mt-4 voice-btn-outline text-xs">+ Add Rule</button>
        </Section>

        <Section title="Booking Rules">
          <ToggleRow label="Ask preferred day first" />
          <ToggleRow label="Offer earliest availability" defaultOn={false} />
          <ToggleRow label="Confirm date/time verbally" />
          <ToggleRow label="Send SMS confirmation" />
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Slots to offer</label>
              <select className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-sm">
                <option>3</option>
                <option>2</option>
                <option>5</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Minimum notice</label>
              <select className="mt-1 h-9 w-full rounded-lg border border-border px-2 text-sm">
                <option>2 hours</option>
                <option>24 hours</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Transfer & Escalation Rules">
          <ToggleRow label="Warm transfer when possible" />
          <ToggleRow label="Take message if transfer fails" />
          <ToggleRow label="Notify owner on failed transfer" />
        </Section>

        <Section title="Knowledge Behavior">
          <ToggleRow label="Answer only from approved knowledge" />
          <ToggleRow label="Allow general business answers" defaultOn={false} />
          <div className="mt-2">
            <label className="text-sm font-medium">If uncertain</label>
            <select className="mt-1.5 h-10 w-full max-w-xs rounded-lg border border-border px-3 text-sm">
              <option>Take a message</option>
              <option>Say she doesn&apos;t know</option>
              <option>Transfer</option>
            </select>
          </div>
        </Section>

        <Section title="Actions & Permissions">
          <ToggleRow label="Take messages" />
          <ToggleRow label="Update contact information" />
          <ToggleRow label="Send SMS" />
          <ToggleRow label="Book appointments" />
          <ToggleRow label="Transfer calls" />
          <ToggleRow label="Cancel appointments" defaultOn={false} />
          <ToggleRow label="Reschedule appointments" defaultOn={false} />
        </Section>

        <Section title="Fallback & Failure Handling">
          <p className="text-sm text-muted-foreground">
            If Amy cannot understand after 2 attempts → Take a message
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            If booking fails → Tell caller someone will follow up
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            If transfer fails → Return to Amy and take a message
          </p>
        </Section>

        <Section title="Notifications & Results">
          <ToggleRow label="Send call summary" />
          <ToggleRow label="Notify me for urgent calls" />
          <ToggleRow label="Notify me for new customers" />
          <ToggleRow label="Notify me when a transfer fails" />
          <Segmented label="Summary detail" options={["Short", "Standard", "Detailed"]} defaultValue="Standard" />
        </Section>

        <Section title="Developer / Expert">
          <p className="text-sm text-muted-foreground">
            Webhooks, API actions, custom tools, and raw instructions — for technical users only.
          </p>
          <button type="button" className="mt-3 voice-btn-outline text-xs">
            Open developer tools
          </button>
        </Section>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-6">
        <button type="button" className="voice-btn-outline">Discard</button>
        <button type="button" className="voice-btn-primary">Save Changes</button>
      </div>
    </div>
  );
}
