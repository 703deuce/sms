"use client";

import { PhonePreview } from "@/components/campaigns/broadcast/phone-preview";
import {
  MockupMessageToolbar,
  MockupWizardFooter,
  MockupWizardSection,
  MockupWizardStepper,
} from "@/components/automate/mockup-automate-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  delayLabel,
  dripTriggerLabel,
  newDripStep,
  type DripCampaignRecord,
  type DripCampaignTriggerType,
  type DripStep,
  type DripTriggerConfig,
} from "@/lib/drip-campaigns/types";
import {
  dripCampaignDetailHref,
  dripCampaignsListHref,
} from "@/lib/drip-campaigns/routes";
import { cn, estimateSmsSegments, formatPhone } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  Info,
  MessageSquare,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const WIZARD_STEPS = ["Setup", "Messages", "Review"];

const TRIGGERS: Array<{
  id: DripCampaignTriggerType;
  label: string;
  description?: string;
  needsList?: boolean;
  needsTag?: boolean;
  needsForm?: boolean;
}> = [
  { id: "tag_added", label: "Contact Tag Added", needsTag: true },
  { id: "list_join", label: "Contact Joins a List", needsList: true },
  {
    id: "contact_added",
    label: "New Contact is Added",
    description:
      "When a contact is first created (manual, form, or first inbound text). To target list membership, use Contact Joins a List.",
  },
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
      router.push(
        mode === "edit" && initial
          ? dripCampaignDetailHref(initial.id)
          : dripCampaignsListHref(),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const fieldLabel = "mb-1.5 block text-[13px] font-semibold text-foreground";

  return (
    <div className="mx-auto max-w-5xl text-[13px]">
      <div className="mb-6">
        <p className="mb-1 text-[12px] font-medium text-primary">
          <Link href={dripCampaignsListHref()} className="hover:underline">
            Drip Campaigns
          </Link>
          <span className="mx-2 text-muted-foreground">/</span>
          {mode === "edit" ? "Edit" : "Create"}
        </p>
        <h1 className="font-display text-[26px] font-semibold tracking-tight text-foreground">
          {mode === "edit" ? "Edit Drip Campaign" : "Create Drip Campaign"}
        </h1>
      </div>

      <MockupWizardStepper steps={WIZARD_STEPS} activeIndex={step} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-6 sm:p-7">
          {step === 0 ? (
            <div>
              <MockupWizardSection
                title="Campaign setup"
                description="Name your drip and choose when the sequence should start."
              />
              <div className="space-y-5">
                <div>
                  <Label htmlFor="name" className={fieldLabel}>
                    Campaign Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="New Lead Welcome Series"
                  />
                </div>
                <div>
                  <Label htmlFor="trigger" className={fieldLabel}>
                    Trigger Event
                  </Label>
                  <Select
                    id="trigger"
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
                  </Select>
                  {selectedTrigger?.description ? (
                    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                      {selectedTrigger.description}
                    </p>
                  ) : null}
                </div>
                {selectedTrigger?.needsTag ? (
                  <div>
                    <Label htmlFor="trigger-tag" className={fieldLabel}>
                      Specific Tag
                    </Label>
                    <Select
                      id="trigger-tag"
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
                    </Select>
                  </div>
                ) : null}
                {selectedTrigger?.needsList ? (
                  <div>
                    <Label htmlFor="trigger-list" className={fieldLabel}>
                      Target List
                    </Label>
                    <Select
                      id="trigger-list"
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
                    </Select>
                  </div>
                ) : null}
                {selectedTrigger?.needsForm ? (
                  <div>
                    <Label htmlFor="trigger-form" className={fieldLabel}>
                      Form
                    </Label>
                    <Select
                      id="trigger-form"
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
                    </Select>
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="phone" className={fieldLabel}>
                    Phone Number
                  </Label>
                  <Select
                    id="phone"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                  >
                    <option value="">Select sending number</option>
                    {phones.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} · {formatPhone(p.e164)}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    Messages in this sequence will be sent from this number.
                  </p>
                </div>
              </div>

              <MockupWizardFooter
                onCancel={() => router.push(dripCampaignsListHref())}
                onNext={() => setStep(1)}
                nextLabel="Next: Messages"
                nextDisabled={!canNextFromSetup}
              />
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <MockupWizardSection
                title="Message sequence"
                description="Build the timed messages contacts will receive after the trigger fires."
              />

              <div className="grid items-start gap-5 md:grid-cols-[220px_1fr]">
                {/* Sequence rail */}
                <div className="space-y-2">
                  {steps.map((s, i) => {
                    const isActive = i === activeMessageIndex;
                    const filled = s.message.trim().length > 0;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveMessageIndex(i)}
                        className={cn(
                          "group flex w-full items-center gap-2.5 rounded-xl border p-3 text-left transition-all duration-150",
                          isActive
                            ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                            : "border-border bg-card hover:border-border hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : filled
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {filled && !isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-foreground">
                            Message {i + 1}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="truncate">{delayLabel(s, i)}</span>
                          </span>
                        </span>
                        {steps.length > 1 ? (
                          <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMessage(i);
                            }}
                            className="rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-danger/10 hover:text-danger"
                            aria-label={`Remove message ${i + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMessage}
                    className="w-full border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add message
                  </Button>
                </div>

                {/* Editor */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Message {activeMessageIndex + 1}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                        characters === 0
                          ? "bg-muted text-muted-foreground"
                          : segments > 1
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700",
                      )}
                    >
                      {characters} chars · {segments || 0} SMS
                    </span>
                  </div>

                  <div className="mb-4 grid grid-cols-[1fr_130px] gap-2">
                    <div>
                      <Label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Send after
                      </Label>
                      <Select
                        value={activeStep?.delayUnit || "immediate"}
                        onChange={(e) =>
                          updateStep(activeMessageIndex, {
                            delayUnit: e.target.value as DripStep["delayUnit"],
                          })
                        }
                        className="h-9 text-[13px]"
                      >
                        <option value="immediate">
                          {activeMessageIndex === 0 ? "When triggered" : "Immediately"}
                        </option>
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </Select>
                    </div>
                    {activeStep?.delayUnit !== "immediate" ? (
                      <div>
                        <Label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Wait
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={activeStep?.delayAmount || 1}
                          onChange={(e) =>
                            updateStep(activeMessageIndex, {
                              delayAmount: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="h-9 text-[13px]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-end pb-2 text-[11px] text-muted-foreground">
                        No delay
                      </div>
                    )}
                  </div>

                  <Textarea
                    value={activeStep?.message || ""}
                    onChange={(e) =>
                      updateStep(activeMessageIndex, { message: e.target.value })
                    }
                    placeholder="Hi {{firstName}}, thanks for reaching out! …"
                    className="min-h-32 bg-card"
                  />
                  <MockupMessageToolbar onInsert={insertVariable} />
                </div>
              </div>

              <MockupWizardFooter
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
                nextLabel="Next: Review"
                nextDisabled={!canNextFromMessages}
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <MockupWizardSection
                title="Review & launch"
                description="Confirm the details below before activating this drip campaign."
              />

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" /> Name
                    </p>
                    <p className="mt-1.5 truncate text-[14px] font-semibold text-foreground">
                      {name || "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Zap className="h-3.5 w-3.5" /> Trigger
                    </p>
                    <p className="mt-1.5 text-[14px] font-semibold text-foreground">
                      {triggerType ? dripTriggerLabel(triggerType, triggerConfig) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> From
                    </p>
                    <p className="mt-1.5 text-[14px] font-semibold text-foreground">
                      {selectedPhone ? formatPhone(selectedPhone.e164) : "—"}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="border-b border-border bg-muted/30 px-4 py-2.5">
                    <p className="text-[12px] font-semibold text-foreground">
                      Sequence · {steps.length} message{steps.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ol className="divide-y divide-border">
                    {steps.map((s, i) => (
                      <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {delayLabel(s, i)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
                            {s.message}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {error ? (
                  <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] font-medium text-danger">
                    {error}
                  </p>
                ) : null}
              </div>

              <MockupWizardFooter
                onBack={() => setStep(1)}
                nextLabel={
                  saving
                    ? "Saving…"
                    : mode === "edit"
                      ? "Save Changes"
                      : "Save & Activate"
                }
                onNext={() => save(true)}
                nextLoading={saving}
                extraActions={
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={saving}
                    onClick={() => save(false)}
                  >
                    Save as Paused
                  </Button>
                }
              />
            </div>
          ) : null}
        </Card>

        {/* Right rail */}
        <div className="space-y-4 lg:sticky lg:top-6">
          {step === 0 ? (
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Info className="h-3.5 w-3.5" />
                </span>
                About Drip Campaigns
              </p>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                Drip campaigns send a timed series of SMS messages when a contact
                matches your trigger — like joining a list or receiving a tag.
                Each message can wait minutes, hours, or days after the previous
                step.
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
    </div>
  );
}
