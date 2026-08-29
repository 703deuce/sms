"use client";

import { PhonePreview } from "@/components/campaigns/broadcast/phone-preview";
import {
  MockupMessageToolbar,
  MockupTriggerCard,
  MockupWizardFooter,
  MockupWizardSection,
  MockupWizardStepper,
} from "@/components/automate/mockup-automate-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  autoReplyTriggerLabel,
  type AutoReplyRecord,
  type AutoReplyRules,
  type AutoReplyTriggerConfig,
  type AutoReplyTriggerType,
} from "@/lib/auto-replies/types";
import { DEFAULT_AUTO_REPLY_RULES } from "@/lib/auto-replies/types";
import { estimateSmsSegments } from "@/lib/utils";
import {
  FileText,
  List,
  PhoneMissed,
  Tag,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const WIZARD_STEPS = ["Trigger", "Message", "Rules", "Review"];

const TRIGGERS: Array<{
  id: AutoReplyTriggerType;
  label: string;
  description: string;
  icon: typeof UserPlus;
  needsList?: boolean;
  needsTag?: boolean;
  needsForm?: boolean;
}> = [
  {
    id: "contact_added",
    label: "New Contact",
    description:
      "When a contact is first created (manual, form, or first inbound text). To target list membership, use List Join.",
    icon: UserPlus,
  },
  {
    id: "tag_added",
    label: "Tag Added",
    description: "When a specific tag is applied to a contact.",
    icon: Tag,
    needsTag: true,
  },
  {
    id: "list_join",
    label: "List Join",
    description: "When someone is added to a specific audience list.",
    icon: List,
    needsList: true,
  },
  {
    id: "after_hours",
    label: "After Hours",
    description: "When someone texts outside business hours.",
    icon: PhoneMissed,
  },
  {
    id: "form_submitted",
    label: "Form Submitted",
    description: "After an opt-in form submission.",
    icon: FileText,
    needsForm: true,
  },
];

type ListOption = { id: string; name: string };
type TagOption = { id: string; name: string };
type FormOption = { id: string; name: string };

type Props = {
  mode?: "create" | "edit";
  initial?: AutoReplyRecord;
};

export function AutoReplyWizard({ mode = "create", initial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name || "");
  const [triggerType, setTriggerType] = useState<AutoReplyTriggerType | null>(
    initial?.triggerType || null,
  );
  const [triggerConfig, setTriggerConfig] = useState<AutoReplyTriggerConfig>(
    initial?.triggerConfig || {},
  );
  const [message, setMessage] = useState(initial?.message || "");
  const [rules, setRules] = useState<AutoReplyRules>(
    initial?.rules || { ...DEFAULT_AUTO_REPLY_RULES },
  );
  const [lists, setLists] = useState<ListOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedTrigger = TRIGGERS.find((t) => t.id === triggerType);
  const { characters, segments } = estimateSmsSegments(message);

  useEffect(() => {
    Promise.all([
      fetch("/api/contacts/lists").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/contacts/tags").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/growth/forms").then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    ]).then(([listsJson, tagsJson, formsJson]) => {
      setLists(
        (listsJson.data || []).map((l: { id: string; name: string }) => ({
          id: l.id,
          name: l.name,
        })),
      );
      setTags(
        (tagsJson.data || []).map((t: { id: string; name: string }) => ({
          id: t.id,
          name: t.name,
        })),
      );
      setForms(
        (formsJson.data || []).map((f: { id: string; name: string }) => ({
          id: f.id,
          name: f.name,
        })),
      );
    });
  }, []);

  const canNextFromTrigger = useMemo(() => {
    if (!triggerType) return false;
    if (selectedTrigger?.needsList && !triggerConfig.listId) return false;
    if (selectedTrigger?.needsTag && !triggerConfig.tagId) return false;
    if (selectedTrigger?.needsForm && !triggerConfig.formId) return false;
    return true;
  }, [triggerType, triggerConfig, selectedTrigger]);

  function insertVariable(token: string) {
    setMessage((m) => `${m}${token}`);
  }

  async function save(activate: boolean) {
    if (!name.trim() || !triggerType || !message.trim()) {
      setError("Name, trigger, and message are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        triggerType,
        triggerConfig,
        message: message.trim(),
        status: activate ? "active" : "paused",
        rules,
      };
      const url =
        mode === "edit" && initial ? `/api/auto-replies/${initial.id}` : "/api/auto-replies";
      const res = await fetch(url, {
        method: mode === "edit" && initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save auto reply");
      router.push(mode === "edit" && initial ? `/auto-replies/${initial.id}` : "/auto-replies");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-[13px]">
      <div className="mb-2">
        <p className="mb-1 text-[12px] font-medium text-primary">
          <Link href="/auto-replies" className="hover:underline">
            Auto Replies
          </Link>
          <span className="mx-2 text-slate-400">/</span>
          {mode === "edit" ? "Edit" : "Create"}
        </p>
        <h1 className="font-display text-[28px] font-semibold text-slate-900">
          {mode === "edit" ? "Edit Auto Reply" : "Create Auto Reply"}
        </h1>
      </div>

      <MockupWizardStepper steps={WIZARD_STEPS} activeIndex={step} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="rounded-xl border-slate-200 p-6 shadow-sm">
          {step === 0 ? (
            <div>
              <MockupWizardSection
                title="Choose your trigger"
                description="When should this auto-reply be sent?"
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TRIGGERS.map((trigger) => (
                  <MockupTriggerCard
                    key={trigger.id}
                    icon={trigger.icon}
                    label={trigger.label}
                    description={trigger.description}
                    selected={triggerType === trigger.id}
                    onClick={() => {
                      setTriggerType(trigger.id);
                      setTriggerConfig({});
                    }}
                  />
                ))}
              </div>
              {selectedTrigger?.needsList ? (
                <div className="mt-6 max-w-md">
                  <Label>List</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                    value={triggerConfig.listId || ""}
                    onChange={(e) => {
                      const list = lists.find((l) => l.id === e.target.value);
                      setTriggerConfig({
                        listId: e.target.value,
                        listName: list?.name,
                      });
                    }}
                  >
                    <option value="">Select a list</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {selectedTrigger?.needsTag ? (
                <div className="mt-6 max-w-md">
                  <Label>Tag</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                    value={triggerConfig.tagId || ""}
                    onChange={(e) => {
                      const tag = tags.find((t) => t.id === e.target.value);
                      setTriggerConfig({
                        tagId: e.target.value,
                        tagName: tag?.name,
                      });
                    }}
                  >
                    <option value="">Select a tag</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {selectedTrigger?.needsForm ? (
                <div className="mt-6 max-w-md">
                  <Label>Form</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                    value={triggerConfig.formId || ""}
                    onChange={(e) => {
                      const form = forms.find((f) => f.id === e.target.value);
                      setTriggerConfig({
                        formId: e.target.value,
                        formName: form?.name,
                      });
                    }}
                  >
                    <option value="">Select a form</option>
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <MockupWizardSection
                title="Compose your message"
                description="Name your auto reply and write the SMS your contacts will receive."
              />
              <div>
                <Label htmlFor="name">Name your auto reply</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Intro Reply"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Hi {{firstName}}, thanks for reaching out..."
                  className="mt-1"
                />
                <MockupMessageToolbar onInsert={insertVariable} />
                <p className="mt-2 text-[12px] text-slate-500">
                  {characters} characters · {segments} SMS segment{segments === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
                <p className="text-[13px] font-medium text-slate-600">Media attachments</p>
                <p className="mt-1 text-[12px] text-slate-400">MMS media upload coming soon</p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <MockupWizardSection
                title="Delivery rules"
                description="Control when and how often this auto reply sends."
              />
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[14px] font-semibold text-slate-900">Sending window</p>
                <label className="mt-3 flex items-center gap-2 text-[13px] text-slate-700">
                  <input
                    type="radio"
                    checked={!rules.respectQuietHours}
                    onChange={() => setRules((r) => ({ ...r, respectQuietHours: false }))}
                  />
                  Send anytime
                </label>
                <label className="mt-2 flex items-center gap-2 text-[13px] text-slate-700">
                  <input
                    type="radio"
                    checked={rules.respectQuietHours}
                    onChange={() => setRules((r) => ({ ...r, respectQuietHours: true }))}
                  />
                  Respect quiet hours / business schedule
                </label>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[14px] font-semibold text-slate-900">Frequency</p>
                <label className="mt-3 flex items-center gap-2 text-[13px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={rules.oncePerContact}
                    onChange={(e) =>
                      setRules((r) => ({ ...r, oncePerContact: e.target.checked }))
                    }
                  />
                  Don&apos;t send more than once per contact
                </label>
                <label className="mt-2 flex items-center gap-2 text-[13px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={rules.excludeUnsubscribed}
                    onChange={(e) =>
                      setRules((r) => ({ ...r, excludeUnsubscribed: e.target.checked }))
                    }
                  />
                  Do not send to unsubscribed contacts
                </label>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <MockupWizardSection
                title="Review & activate"
                description="Confirm everything looks right before publishing."
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                <dl className="space-y-3 text-[13px]">
                  <div className="flex justify-between gap-4 border-b border-slate-200/80 pb-3">
                    <dt className="text-slate-500">Name</dt>
                    <dd className="font-semibold text-slate-900">{name || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-200/80 pb-3">
                    <dt className="text-slate-500">Trigger</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {triggerType
                        ? autoReplyTriggerLabel(triggerType, triggerConfig)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Message</dt>
                    <dd className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-slate-700">
                      {message || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 pt-1">
                    <dt className="text-slate-500">Rules</dt>
                    <dd className="text-right text-slate-700">
                      {rules.oncePerContact ? "Once per contact" : "May repeat"}
                      {rules.respectQuietHours ? " · Quiet hours" : " · Anytime"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-[13px] text-rose-600">{error}</p> : null}

          <MockupWizardFooter
            onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
            onCancel={step === 0 ? () => router.push("/auto-replies") : undefined}
            onNext={
              step < 2
                ? () => setStep((s) => s + 1)
                : step === 2
                  ? () => setStep(3)
                  : () => void save(true)
            }
            nextLabel={step === 3 ? (saving ? "Activating…" : "Activate & Publish") : "Next"}
            nextDisabled={
              step === 0
                ? !canNextFromTrigger
                : step === 1
                  ? !message.trim() || !name.trim()
                  : step === 3 && saving
            }
            nextLoading={step === 3 && saving}
            extraActions={
              step === 3 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void save(false)}
                >
                  Save as draft
                </Button>
              ) : undefined
            }
          />
        </Card>

        <PhonePreview message={message} className="lg:sticky lg:top-6" />
      </div>
    </div>
  );
}
