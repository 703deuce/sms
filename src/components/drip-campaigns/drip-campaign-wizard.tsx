"use client";

import { PhonePreview } from "@/components/campaigns/broadcast/phone-preview";
import { DripWizardStepper } from "@/components/drip-campaigns/drip-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  delayLabel,
  dripTriggerLabel,
  newDripStep,
  type DripCampaignRecord,
  type DripCampaignTriggerType,
  type DripStep,
  type DripTriggerConfig,
} from "@/lib/drip-campaigns/types";
import { cn, estimateSmsSegments, formatPhone } from "@/lib/utils";
import { Braces, Info, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const WIZARD_STEPS = ["Setup", "Messages", "Review"];

const TRIGGERS: Array<{
  id: DripCampaignTriggerType;
  label: string;
  needsList?: boolean;
  needsTag?: boolean;
  needsForm?: boolean;
}> = [
  { id: "tag_added", label: "Contact Tag Added", needsTag: true },
  { id: "list_join", label: "Contact Joins a List", needsList: true },
  { id: "contact_added", label: "New Contact is Added" },
  { id: "form_submitted", label: "Form is Submitted", needsForm: true },
];

type PhoneOption = { id: string; e164: string; label: string };
type ListOption = { id: string; name: string };
type TagOption = { id: string; name: string };
type FormOption = { id: string; name: string };

type Props = {
  mode?: "create" | "edit";
  initial?: DripCampaignRecord;
};

export function DripCampaignWizard({ mode = "create", initial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name || "");
  const [triggerType, setTriggerType] = useState<DripCampaignTriggerType | null>(
    initial?.triggerType || null,
  );
  const [triggerConfig, setTriggerConfig] = useState<DripTriggerConfig>(
    initial?.triggerConfig || {},
  );
  const [phoneNumberId, setPhoneNumberId] = useState(initial?.phoneNumberId || "");
  const [steps, setSteps] = useState<DripStep[]>(
    initial?.steps?.length ? initial.steps : [newDripStep(0)],
  );
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [phones, setPhones] = useState<PhoneOption[]>([]);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedTrigger = TRIGGERS.find((t) => t.id === triggerType);
  const activeStep = steps[activeMessageIndex] || steps[0];
  const selectedPhone = phones.find((p) => p.id === phoneNumberId);
  const { characters, segments } = estimateSmsSegments(activeStep?.message || "");

  useEffect(() => {
    Promise.all([
      fetch("/api/numbers").then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch("/api/contacts/lists").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/contacts/tags").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/growth/forms").then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    ]).then(([phonesJson, listsJson, tagsJson, formsJson]) => {
      setPhones(
        (phonesJson.data || []).map((p: { id: string; number: string; friendlyName?: string }) => ({
          id: p.id,
          e164: p.number,
          label: p.friendlyName || p.number,
        })),
      );
      setLists((listsJson.data || []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })));
      setTags((tagsJson.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      setForms((formsJson.data || []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })));
    });
  }, []);

  const canNextFromSetup = useMemo(() => {
    if (!name.trim() || !triggerType || !phoneNumberId) return false;
    if (selectedTrigger?.needsList && !triggerConfig.listId) return false;
    if (selectedTrigger?.needsTag && !triggerConfig.tagId) return false;
    if (selectedTrigger?.needsForm && !triggerConfig.formId) return false;
    return true;
  }, [name, triggerType, phoneNumberId, triggerConfig, selectedTrigger]);

  const canNextFromMessages = steps.every((s) => s.message.trim().length > 0);

  function updateStep(index: number, patch: Partial<DripStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addMessage() {
    setSteps((prev) => [...prev, newDripStep(prev.length)]);
    setActiveMessageIndex(steps.length);
  }

  function removeMessage(index: number) {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setActiveMessageIndex((i) => Math.max(0, i >= index ? i - 1 : i));
  }

  function insertVariable(token: string) {
    const cur = activeStep?.message || "";
    updateStep(activeMessageIndex, { message: `${cur}${token}` });
  }

  async function save(launch: boolean) {
    if (!name.trim() || !triggerType || !phoneNumberId || !steps.every((s) => s.message.trim())) {
      setError("Complete all required fields and messages.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        triggerType,
        triggerConfig,
        phoneNumberId,
        steps,
        status: launch ? "active" : "paused",
      };
      const url =
        mode === "edit" && initial ? `/api/drip-campaigns/${initial.id}` : "/api/drip-campaigns";
      const res = await fetch(url, {
        method: mode === "edit" && initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save drip campaign");
      router.push(mode === "edit" && initial ? `/drip-campaigns/${initial.id}` : "/drip-campaigns");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-[13px]">
      <div className="mb-6">
        <p className="mb-1 text-[12px] font-medium text-primary">
          <Link href="/drip-campaigns" className="hover:underline">
            Drip Campaigns
          </Link>
          <span className="mx-2 text-slate-400">/</span>
          {mode === "edit" ? "Edit" : "Create"}
        </p>
        <h1 className="font-display text-[28px] font-semibold text-slate-900">
          {mode === "edit" ? "Edit Drip Campaign" : "Create Drip Campaign"}
        </h1>
      </div>

      <DripWizardStepper steps={WIZARD_STEPS} activeIndex={step} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="rounded-xl border-slate-200 p-6 shadow-sm">
          {step === 0 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New Lead Welcome Series"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Trigger Event</Label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                  value={triggerType || ""}
                  onChange={(e) => {
                    setTriggerType(e.target.value as DripCampaignTriggerType);
                    setTriggerConfig({});
                  }}
                >
                  <option value="">Select trigger</option>
                  {TRIGGERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {selectedTrigger?.needsTag ? (
                <div>
                  <Label>Specific Tag</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                    value={triggerConfig.tagId || ""}
                    onChange={(e) => {
                      const tag = tags.find((t) => t.id === e.target.value);
                      setTriggerConfig({ tagId: e.target.value, tagName: tag?.name });
                    }}
                  >
                    <option value="">Select tag</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {selectedTrigger?.needsList ? (
                <div>
                  <Label>Target List</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                    value={triggerConfig.listId || ""}
                    onChange={(e) => {
                      const list = lists.find((l) => l.id === e.target.value);
                      setTriggerConfig({ listId: e.target.value, listName: list?.name });
                    }}
                  >
                    <option value="">Select list</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {selectedTrigger?.needsForm ? (
                <div>
                  <Label>Form</Label>
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                    value={triggerConfig.formId || ""}
                    onChange={(e) => {
                      const form = forms.find((f) => f.id === e.target.value);
                      setTriggerConfig({ formId: e.target.value, formName: form?.name });
                    }}
                  >
                    <option value="">Select form</option>
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <Label>Phone Number</Label>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                >
                  <option value="">Select sending number</option>
                  {phones.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatPhone(p.e164)} — {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {steps.map((msg, index) => (
                  <div
                    key={msg.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveMessageIndex(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setActiveMessageIndex(index);
                    }}
                    className={cn(
                      "w-full cursor-pointer rounded-xl border p-4 text-left transition",
                      activeMessageIndex === index
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">Message {index + 1}</p>
                      {steps.length > 1 ? (
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMessage(index);
                          }}
                          aria-label="Remove message"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[12px] text-slate-500">{delayLabel(msg, index)}</p>
                    <p className="mt-2 line-clamp-2 text-[13px] text-slate-600">
                      {msg.message || "No message yet"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Label className="mb-0">Message {activeMessageIndex + 1}</Label>
                  {activeMessageIndex > 0 ? (
                    <div className="ml-auto flex items-center gap-2 text-[12px] text-slate-600">
                      <span>Send</span>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 w-16"
                        value={activeStep.delayAmount || 1}
                        onChange={(e) =>
                          updateStep(activeMessageIndex, {
                            delayAmount: Number(e.target.value) || 1,
                          })
                        }
                      />
                      <select
                        className="h-8 rounded-lg border border-slate-200 px-2"
                        value={activeStep.delayUnit}
                        onChange={(e) =>
                          updateStep(activeMessageIndex, {
                            delayUnit: e.target.value as DripStep["delayUnit"],
                          })
                        }
                      >
                        <option value="minutes">Minute(s)</option>
                        <option value="hours">Hour(s)</option>
                        <option value="days">Day(s)</option>
                      </select>
                      <span>after previous message</span>
                    </div>
                  ) : (
                    <span className="ml-auto text-[12px] text-slate-500">Send immediately</span>
                  )}
                </div>
                <div className="mb-2 flex gap-2">
                  {["{{firstName}}", "{{lastName}}", "{{businessName}}"].map((token) => (
                    <button
                      key={token}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600"
                      onClick={() => insertVariable(token)}
                    >
                      <Braces className="h-3 w-3" />
                      {token.replace(/\{\{|\}\}/g, "")}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={activeStep.message}
                  onChange={(e) => updateStep(activeMessageIndex, { message: e.target.value })}
                  rows={6}
                  placeholder="Hi {{firstName}}, thanks for joining..."
                />
                <p className="mt-2 text-[12px] text-slate-500">
                  {characters} characters · {segments} SMS segment{segments === 1 ? "" : "s"}
                </p>
              </div>

              <Button type="button" variant="outline" className="gap-2" onClick={addMessage}>
                <Plus className="h-4 w-4" />
                Add Message
              </Button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  Campaign Details
                </p>
                <dl className="mt-3 space-y-2 text-[13px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Name</dt>
                    <dd className="font-semibold text-slate-900">{name}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Trigger</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {triggerType ? dripTriggerLabel(triggerType, triggerConfig) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Sending Number</dt>
                    <dd className="font-medium text-slate-900">
                      {selectedPhone ? formatPhone(selectedPhone.e164) : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-slate-900">Sequence Preview</p>
                <ul className="mt-3 space-y-2">
                  {steps.map((msg, index) => (
                    <li
                      key={msg.id}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px]"
                    >
                      <p className="font-semibold text-slate-900">
                        Message {index + 1}: {index === 0 ? "Immediate" : delayLabel(msg, index)}
                      </p>
                      <p className="mt-1 text-slate-600">{msg.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-[13px] text-rose-600">{error}</p> : null}

          <div className="mt-6 flex justify-between gap-3">
            <div>
              {step > 0 ? (
                <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              ) : (
                <Link
                  href="/drip-campaigns"
                  className="inline-flex h-10 items-center rounded-lg border px-4 text-[13px] font-semibold no-underline"
                >
                  Cancel
                </Link>
              )}
            </div>
            <div className="flex gap-2">
              {step < 2 ? (
                <Button
                  type="button"
                  disabled={
                    step === 0 ? !canNextFromSetup : !canNextFromMessages
                  }
                  onClick={() => setStep((s) => s + 1)}
                >
                  {step === 0 ? "Next: Messages" : "Next: Review"}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void save(false)}>
                    Save
                  </Button>
                  <Button type="button" disabled={saving} onClick={() => void save(true)}>
                    {saving ? "Launching…" : "Launch Campaign"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        {step === 0 ? (
          <Card className="h-fit rounded-xl border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-900">
              <Info className="h-4 w-4 text-primary" />
              About Drip Campaigns
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
              Drip campaigns send a timed series of SMS messages when a contact matches your
              trigger — like joining a list or receiving a tag. Each message can wait minutes,
              hours, or days after the previous step.
            </p>
          </Card>
        ) : (
          <PhonePreview
            message={activeStep?.message || ""}
            senderLabel={selectedPhone?.e164}
          />
        )}
      </div>
    </div>
  );
}
