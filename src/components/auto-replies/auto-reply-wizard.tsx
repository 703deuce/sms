"use client";

import { PhonePreview } from "@/components/campaigns/broadcast/phone-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import type {
  AutoReplyRecord,
  AutoReplyRules,
  AutoReplyTriggerConfig,
  AutoReplyTriggerType,
} from "@/lib/auto-replies/types";
import { DEFAULT_AUTO_REPLY_RULES } from "@/lib/auto-replies/types";
import { cn, estimateSmsSegments } from "@/lib/utils";
import {
  Clock,
  FileText,
  List,
  Tag,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const TRIGGERS: Array<{
  id: AutoReplyTriggerType;
  label: string;
  description: string;
  icon: typeof Users;
  needsList?: boolean;
  needsTag?: boolean;
  needsForm?: boolean;
}> = [
  {
    id: "list_join",
    label: "Contact joins a list",
    description: "Send when someone is added to a specific list.",
    icon: List,
    needsList: true,
  },
  {
    id: "contact_added",
    label: "New contact is added",
    description: "Send when a new contact is created in your workspace.",
    icon: UserPlus,
  },
  {
    id: "form_submitted",
    label: "Form is submitted",
    description: "Send after an opt-in form submission.",
    icon: FileText,
    needsForm: true,
  },
  {
    id: "after_hours",
    label: "After-hours message received",
    description: "Send when someone texts outside business hours.",
    icon: Clock,
  },
  {
    id: "tag_added",
    label: "Tag is added",
    description: "Send when a specific tag is applied to a contact.",
    icon: Tag,
    needsTag: true,
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
      router.push("/auto-replies");
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
          <Link href="/auto-replies" className="hover:underline">
            Auto Replies
          </Link>
          <span className="mx-2 text-slate-400">/</span>
          {mode === "edit" ? "Edit" : "New"}
        </p>
        <h1 className="font-display text-[28px] font-semibold text-slate-900">
          {mode === "edit" ? "Edit Auto Reply" : "Create Auto Reply"}
        </h1>
      </div>

      <div className="mb-6 flex gap-2">
        {([1, 2, 3] as const).map((n) => (
          <div
            key={n}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-semibold",
              step === n ? "bg-primary text-white" : "bg-slate-100 text-slate-500",
            )}
          >
            {n}. {n === 1 ? "Trigger" : n === 2 ? "Message" : "Rules"}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="rounded-xl border-slate-200 p-6 shadow-sm">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Auto reply name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="New Lead Welcome"
                  className="mt-1"
                />
              </div>
              <p className="text-[14px] font-semibold text-slate-900">Choose a trigger</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {TRIGGERS.map((trigger) => {
                  const Icon = trigger.icon;
                  const selected = triggerType === trigger.id;
                  return (
                    <button
                      key={trigger.id}
                      type="button"
                      onClick={() => {
                        setTriggerType(trigger.id);
                        setTriggerConfig({});
                      }}
                      className={cn(
                        "rounded-xl border p-4 text-left transition",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-slate-200 hover:border-slate-300",
                      )}
                    >
                      <Icon className="mb-2 h-5 w-5 text-primary" />
                      <p className="font-semibold text-slate-900">{trigger.label}</p>
                      <p className="mt-1 text-[12px] text-slate-500">{trigger.description}</p>
                    </button>
                  );
                })}
              </div>
              {selectedTrigger?.needsList ? (
                <div>
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
                <div>
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
                <div>
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

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-slate-900">Compose your message</p>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                placeholder="Hi {{firstName}}, thanks for reaching out..."
              />
              <p className="text-[12px] text-slate-500">
                {characters} characters · {segments} SMS segment{segments === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-slate-900">Rules</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rules.oncePerContact}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, oncePerContact: e.target.checked }))
                  }
                />
                Send only once per contact
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rules.excludeUnsubscribed}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, excludeUnsubscribed: e.target.checked }))
                  }
                />
                Do not send to unsubscribed contacts
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rules.respectQuietHours}
                  onChange={(e) =>
                    setRules((r) => ({ ...r, respectQuietHours: e.target.checked }))
                  }
                />
                Respect quiet hours
              </label>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-[13px] text-rose-600">{error}</p> : null}

          <div className="mt-6 flex justify-between gap-3">
            <div>
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                  Back
                </Button>
              ) : (
                <Link href="/auto-replies" className={cn("inline-flex h-10 items-center rounded-lg border px-4 text-[13px] font-semibold no-underline")}>
                  Cancel
                </Link>
              )}
            </div>
            <div className="flex gap-2">
              {step < 3 ? (
                <Button
                  type="button"
                  disabled={step === 1 ? !canNextFromTrigger || !name.trim() : !message.trim()}
                  onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                >
                  Next
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void save(false)}>
                    Save
                  </Button>
                  <Button type="button" disabled={saving} onClick={() => void save(true)}>
                    {saving ? "Saving…" : "Save & Activate"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        <PhonePreview message={message} />
      </div>
    </div>
  );
}
