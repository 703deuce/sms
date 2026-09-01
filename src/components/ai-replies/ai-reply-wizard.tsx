"use client";

import { AiChatPreview } from "@/components/ai-replies/ai-reply-ui";
import {
  V1Breadcrumb,
  V1ChoiceCard,
  V1WizardFooter,
  V1WizardSection,
  V1WizardStepper,
  type WizardStep,
} from "@/components/v1/v1-polish";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  DEFAULT_AI_ADVANCED,
  AI_REPLY_LENGTHS,
  AI_REPLY_TONES,
  triggerSummary,
  type AiAdvancedConfig,
  type AiHandoffConfig,
  type AiKnowledgeConfig,
  type AiLeadConfig,
  type AiReplyRecord,
  type AiReplyType,
  type AiTriggerConfig,
} from "@/lib/ai-replies/types";
import { cn, formatPhone } from "@/lib/utils";
import { AlertCircle, Globe, Loader2, MessageCircleQuestion, Plus, Send, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const WIZARD_STEPS: WizardStep[] = [
  { id: "setup", label: "Setup", emoji: "⚙️", hint: "Name & number" },
  { id: "trigger", label: "Trigger", emoji: "🎯", hint: "When to reply" },
  { id: "knowledge", label: "Knowledge", emoji: "🧠", hint: "What it knows" },
  { id: "handoff", label: "Handoff", emoji: "🤝", hint: "Human takeover" },
  { id: "publish", label: "Test & Publish", emoji: "🚀", hint: "Go live" },
];

const TRIGGER_OPTIONS: Array<{ value: NonNullable<AiTriggerConfig["mode"]>; emoji: string; title: string; description: string }> = [
  { value: "all_incoming", emoji: "📥", title: "All incoming", description: "Reply to every inbound text" },
  { value: "keywords", emoji: "🔑", title: "Keywords", description: "Only when messages contain keywords" },
  { value: "segment", emoji: "👥", title: "Segment", description: "Only contacts in a specific segment" },
];

const SCHEDULE_OPTIONS: Array<{ value: NonNullable<AiTriggerConfig["schedule"]>; label: string }> = [
  { value: "always", label: "Always on" },
  { value: "outside_hours", label: "Outside business hours" },
  { value: "business_hours", label: "During business hours" },
];

type Props = { mode?: "create" | "edit"; initial?: AiReplyRecord };

function Pill({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-1 text-[12px] font-medium text-foreground">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground"
      >
        <X className="h-2.5 w-2.5" strokeWidth={3} />
      </button>
    </span>
  );
}

export function AiReplyWizard({ mode = "create", initial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [replyType, setReplyType] = useState<AiReplyType>(initial?.replyType || "conversational");
  const [tone, setTone] = useState(initial?.tone || "professional");
  const [responseLength, setResponseLength] = useState(initial?.responseLength || "medium");
  const [systemPrompt, setSystemPrompt] = useState(
    initial?.systemPrompt ||
      "You are a helpful assistant for our business. Answer questions clearly and help customers.",
  );
  const [phoneNumberId, setPhoneNumberId] = useState(initial?.phoneNumberId || "");
  const [trigger, setTrigger] = useState<AiTriggerConfig>(
    initial?.trigger || { mode: "all_incoming", schedule: "always", keywords: [] },
  );
  const [knowledge, setKnowledge] = useState<AiKnowledgeConfig>(
    initial?.knowledge || { websites: [], textSnippets: [], qaPairs: [] },
  );
  const [lead, setLead] = useState<AiLeadConfig>(initial?.lead || { enabled: false });
  const [handoff, setHandoff] = useState<AiHandoffConfig>(
    initial?.handoff || { enabled: true, keywords: ["agent", "human", "help"] },
  );
  const [advanced, setAdvanced] = useState<AiAdvancedConfig>(
    initial?.advanced || { ...DEFAULT_AI_ADVANCED },
  );
  const [phones, setPhones] = useState<Array<{ id: string; number: string; label: string }>>([]);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [handoffKeywordInput, setHandoffKeywordInput] = useState("");
  const [websiteInput, setWebsiteInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [qaQ, setQaQ] = useState("");
  const [qaA, setQaA] = useState("");
  const [testInput, setTestInput] = useState("");
  const [testHistory, setTestHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [testDebug, setTestDebug] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedPhone = phones.find((p) => p.id === phoneNumberId);

  useEffect(() => {
    Promise.all([
      fetch("/api/numbers").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/contacts/segments").then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    ]).then(([phonesJson, segmentsJson]) => {
      setPhones(
        (phonesJson.data || []).map((p: { id: string; number: string; friendlyName?: string }) => ({
          id: p.id,
          number: p.number,
          label: p.friendlyName || p.number,
        })),
      );
      setSegments((segmentsJson.data || []).map((s: { id: string; name: string }) => s));
    });
  }, []);

  const draftPayload = useMemo(
    () => ({
      name: name.trim(),
      description: description.trim() || undefined,
      replyType,
      phoneNumberId: phoneNumberId || null,
      tone,
      responseLength,
      systemPrompt,
      trigger,
      knowledge,
      lead,
      handoff,
      advanced,
    }),
    [name, description, replyType, phoneNumberId, tone, responseLength, systemPrompt, trigger, knowledge, lead, handoff, advanced],
  );

  async function runTest() {
    if (!testInput.trim()) return;
    setTesting(true);
    setError("");
    const userMsg = testInput.trim();
    setTestInput("");
    const nextHistory = [...testHistory, { role: "user" as const, content: userMsg }];
    setTestHistory(nextHistory);
    try {
      const res = await fetch("/api/ai-replies/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiReplyId: mode === "edit" && initial ? initial.id : undefined,
          draft: mode === "create" || !initial ? draftPayload : undefined,
          message: userMsg,
          history: nextHistory.slice(0, -1),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test failed");
      setTestHistory((h) => [...h, { role: "assistant", content: json.data.reply }]);
      setTestDebug(json.data.debug?.knowledgeUsed || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function save(publish: boolean) {
    if (!name.trim() || !systemPrompt.trim() || !phoneNumberId) {
      setError("Name, instructions, and phone number are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...draftPayload, status: publish ? "active" : "draft" };
      const url = mode === "edit" && initial ? `/api/ai-replies/${initial.id}` : "/api/ai-replies";
      const res = await fetch(url, {
        method: mode === "edit" && initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save");
      router.push(mode === "edit" && initial ? `/ai-replies/${initial.id}` : "/ai-replies");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const next = () => setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="mx-auto max-w-[1100px] px-1 pb-10 text-[13px]">
      <V1Breadcrumb
        items={[
          { label: "AI Agents", href: "/ai-replies" },
          { label: mode === "edit" ? "Edit agent" : "Create agent" },
        ]}
      />
      <div className="mb-6">
        <h1 className="font-display text-[24px] font-bold tracking-tight text-foreground">
          {mode === "edit" ? `Edit ${name || "agent"}` : "Create AI agent"}
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
          {mode === "edit"
            ? "Update triggers, knowledge, and handoff rules for this agent."
            : "Set up an AI teammate that answers texts with your brand voice."}
        </p>
      </div>

      <V1WizardStepper steps={WIZARD_STEPS} activeIndex={step} onStepClick={(i) => i < step && setStep(i)} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="rounded-[14px] border-border p-6 shadow-sm">
          {error ? (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/[0.06] px-3.5 py-2.5 text-[13px] font-medium text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {step === 0 ? (
            <div>
              <V1WizardSection
                emoji="⚙️"
                title="Basic settings"
                description="Name your agent and choose which number it handles."
              />
              <div className="space-y-5">
                <div>
                  <Label>AI Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="General AI Reply" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this agent do?" />
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <V1ChoiceCard
                      selected={replyType === "conversational"}
                      emoji="💬"
                      title="Conversational AI"
                      description="Multi-turn dialogue with memory and context"
                      onClick={() => setReplyType("conversational")}
                    />
                    <V1ChoiceCard
                      selected={replyType === "single_prompt"}
                      emoji="✨"
                      title="Single prompt"
                      description="One-shot responses per incoming message"
                      onClick={() => setReplyType("single_prompt")}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Tone</Label>
                    <Select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
                      {AI_REPLY_TONES.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Response length</Label>
                    <Select value={responseLength} onChange={(e) => setResponseLength(e.target.value as typeof responseLength)}>
                      {AI_REPLY_LENGTHS.map((l) => (
                        <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Assigned inbox / phone number</Label>
                  <Select value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}>
                    <option value="">Select number</option>
                    {phones.map((p) => (
                      <option key={p.id} value={p.id}>{formatPhone(p.number)} — {p.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <V1WizardFooter onCancel={() => router.push("/ai-replies")} onNext={next} nextLabel="Continue →" />
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <V1WizardSection
                emoji="🎯"
                title="Trigger condition"
                description="When should this AI agent take over the conversation?"
              />
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {TRIGGER_OPTIONS.map((opt) => (
                    <V1ChoiceCard
                      key={opt.value}
                      selected={trigger.mode === opt.value}
                      emoji={opt.emoji}
                      title={opt.title}
                      description={opt.description}
                      onClick={() => setTrigger((t) => ({ ...t, mode: opt.value }))}
                    />
                  ))}
                </div>

                {trigger.mode === "keywords" ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <Label className="mb-2">Trigger keywords</Label>
                    <div className="flex gap-2">
                      <Input
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!keywordInput.trim()) return;
                            setTrigger((t) => ({ ...t, keywords: [...(t.keywords || []), keywordInput.trim()] }));
                            setKeywordInput("");
                          }
                        }}
                        placeholder="help, pricing"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!keywordInput.trim()) return;
                          setTrigger((t) => ({ ...t, keywords: [...(t.keywords || []), keywordInput.trim()] }));
                          setKeywordInput("");
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    </div>
                    {(trigger.keywords || []).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(trigger.keywords || []).map((k) => (
                          <Pill key={k} onRemove={() => setTrigger((t) => ({ ...t, keywords: (t.keywords || []).filter((x) => x !== k) }))}>
                            {k}
                          </Pill>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2.5 text-[12px] text-muted-foreground">No keywords yet — add at least one.</p>
                    )}
                  </div>
                ) : null}

                {trigger.mode === "segment" ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <Label className="mb-2">Segment</Label>
                    <Select
                      value={trigger.segmentId || ""}
                      onChange={(e) => {
                        const seg = segments.find((s) => s.id === e.target.value);
                        setTrigger((t) => ({ ...t, segmentId: e.target.value || undefined, segmentName: seg?.name }));
                      }}
                    >
                      <option value="">Select a segment</option>
                      {segments.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  </div>
                ) : null}

                <div>
                  <Label>Schedule</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {SCHEDULE_OPTIONS.map((opt) => {
                      const selected = (trigger.schedule || "always") === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTrigger((t) => ({ ...t, schedule: opt.value }))}
                          className={cn(
                            "rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-primary/50 bg-primary/[0.06] text-foreground shadow-sm"
                              : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <V1WizardFooter onBack={back} onNext={next} nextLabel="Continue →" />
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <V1WizardSection
                emoji="🧠"
                title="Knowledge & instructions"
                description="Tell your agent what to say and what it should know."
              />
              <div className="space-y-5">
                <div>
                  <Label>System instructions</Label>
                  <Textarea rows={4} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
                  <p className="mt-1.5 text-[12px] text-muted-foreground">
                    This guides every response — include your brand voice and key policies.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <Label className="mb-2 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    Websites
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={websiteInput}
                      onChange={(e) => setWebsiteInput(e.target.value)}
                      placeholder="https://yoursite.com/faq"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!websiteInput.trim()) return;
                        setKnowledge((k) => ({ ...k, websites: [...(k.websites || []), websiteInput.trim()] }));
                        setWebsiteInput("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                  {(knowledge.websites || []).length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(knowledge.websites || []).map((w) => (
                        <Pill key={w} onRemove={() => setKnowledge((k) => ({ ...k, websites: (k.websites || []).filter((x) => x !== w) }))}>
                          {w}
                        </Pill>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <Label className="mb-2">Text snippets</Label>
                  <Textarea rows={2} value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Paste facts, hours, pricing…" />
                  <div className="mt-2.5 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!textInput.trim()) return;
                        setKnowledge((k) => ({ ...k, textSnippets: [...(k.textSnippets || []), textInput.trim()] }));
                        setTextInput("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add snippet
                    </Button>
                  </div>
                  {(knowledge.textSnippets || []).length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {(knowledge.textSnippets || []).map((s, i) => (
                        <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12px] leading-relaxed text-foreground">
                          <span className="line-clamp-2">{s}</span>
                          <button
                            type="button"
                            aria-label="Remove snippet"
                            onClick={() => setKnowledge((k) => ({ ...k, textSnippets: (k.textSnippets || []).filter((_, x) => x !== i) }))}
                            className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <Label className="mb-2 flex items-center gap-1.5">
                    <MessageCircleQuestion className="h-3.5 w-3.5 text-muted-foreground" />
                    Q&A pairs
                  </Label>
                  <div className="space-y-2">
                    <Input value={qaQ} onChange={(e) => setQaQ(e.target.value)} placeholder="Question" />
                    <Textarea rows={2} value={qaA} onChange={(e) => setQaA(e.target.value)} placeholder="Answer" />
                  </div>
                  <div className="mt-2.5 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!qaQ.trim() || !qaA.trim()) return;
                        setKnowledge((k) => ({ ...k, qaPairs: [...(k.qaPairs || []), { question: qaQ.trim(), answer: qaA.trim() }] }));
                        setQaQ("");
                        setQaA("");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Q&A
                    </Button>
                  </div>
                  {(knowledge.qaPairs || []).length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {(knowledge.qaPairs || []).map((qa, i) => (
                        <li key={i} className="rounded-lg border border-border bg-card px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[12px] font-semibold text-foreground">{qa.question}</p>
                            <button
                              type="button"
                              aria-label="Remove Q&A"
                              onClick={() => setKnowledge((k) => ({ ...k, qaPairs: (k.qaPairs || []).filter((_, x) => x !== i) }))}
                              className="shrink-0 text-muted-foreground transition-colors hover:text-danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{qa.answer}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <V1WizardFooter onBack={back} onNext={next} nextLabel="Continue →" />
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <V1WizardSection
                emoji="🤝"
                title="Human handoff"
                description="Decide when the AI steps aside and a teammate takes over."
              />
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setHandoff((h) => ({ ...h, enabled: !h.enabled }))}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    handoff.enabled
                      ? "border-primary/50 bg-primary/[0.05] shadow-sm"
                      : "border-border bg-card hover:border-primary/30",
                  )}
                >
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">Enable human handoff</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Transfer the conversation to your team when the AI can&apos;t help.
                    </p>
                  </div>
                  <span
                    className={cn(
                      "relative h-[22px] w-10 shrink-0 rounded-full transition-colors duration-200",
                      handoff.enabled ? "bg-primary" : "bg-slate-200",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200",
                        handoff.enabled ? "translate-x-[20px]" : "translate-x-[3px]",
                      )}
                    />
                  </span>
                </button>

                {handoff.enabled ? (
                  <>
                    <div className="rounded-xl border border-border bg-muted/20 p-4">
                      <Label className="mb-2">Handoff keywords</Label>
                      <div className="flex gap-2">
                        <Input
                          value={handoffKeywordInput}
                          onChange={(e) => setHandoffKeywordInput(e.target.value)}
                          placeholder="agent, human, help"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (!handoffKeywordInput.trim()) return;
                            setHandoff((h) => ({ ...h, keywords: [...(h.keywords || []), handoffKeywordInput.trim()] }));
                            setHandoffKeywordInput("");
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </div>
                      {(handoff.keywords || []).length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(handoff.keywords || []).map((k) => (
                            <Pill key={k} onRemove={() => setHandoff((h) => ({ ...h, keywords: (h.keywords || []).filter((x) => x !== k) }))}>
                              {k}
                            </Pill>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <Label>Notify email</Label>
                      <Input
                        type="email"
                        value={handoff.notifyEmail || ""}
                        onChange={(e) => setHandoff((h) => ({ ...h, notifyEmail: e.target.value || undefined }))}
                        placeholder="team@yourcompany.com"
                      />
                    </div>
                  </>
                ) : null}

                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-[13px] font-semibold text-foreground">Advanced</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-[12px]">Max replies per contact</Label>
                      <Input
                        type="number"
                        min={1}
                        value={advanced.maxRepliesPerContact ?? 10}
                        onChange={(e) => setAdvanced((a) => ({ ...a, maxRepliesPerContact: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[12px]">Reply delay (seconds)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={advanced.replyDelaySec ?? 3}
                        onChange={(e) => setAdvanced((a) => ({ ...a, replyDelaySec: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <V1WizardFooter onBack={back} onNext={next} nextLabel="Continue →" />
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <V1WizardSection
                emoji="🚀"
                title="Test & publish"
                description="Send a test message in the preview, then publish when you're happy."
              />
              <div className="space-y-5">
                <div>
                  <Label>Test message</Label>
                  <div className="flex gap-2">
                    <Input
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          runTest();
                        }
                      }}
                      placeholder="Ask something a customer would ask…"
                    />
                    <Button type="button" onClick={runTest} disabled={testing || !testInput.trim()}>
                      {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {testing ? "Testing…" : "Send"}
                    </Button>
                  </div>
                  {testDebug.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Knowledge used
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {testDebug.map((d, i) => (
                          <li key={i} className="text-[12px] text-muted-foreground">• {d}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-[13px] font-semibold text-foreground">Summary</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
                      <dt className="text-[12px] text-muted-foreground">Trigger</dt>
                      <dd className="text-right text-[12px] font-medium text-foreground">{triggerSummary(trigger)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
                      <dt className="text-[12px] text-muted-foreground">Number</dt>
                      <dd className="text-right text-[12px] font-medium text-foreground">
                        {selectedPhone ? formatPhone(selectedPhone.number) : "Not selected"}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
                      <dt className="text-[12px] text-muted-foreground">Knowledge sources</dt>
                      <dd className="text-right text-[12px] font-medium text-foreground">
                        {(knowledge.websites?.length || 0) + (knowledge.textSnippets?.length || 0) + (knowledge.qaPairs?.length || 0)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
                      <dt className="text-[12px] text-muted-foreground">Handoff</dt>
                      <dd className="text-right text-[12px] font-medium text-foreground">
                        {handoff.enabled ? "Enabled" : "Disabled"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
              <V1WizardFooter
                onBack={back}
                onNext={() => save(true)}
                nextLabel={mode === "edit" ? "Save & publish" : "Publish agent 🚀"}
                nextLoading={saving}
                extraActions={
                  <Button type="button" variant="outline" disabled={saving} onClick={() => save(false)}>
                    Save as draft
                  </Button>
                }
              />
            </div>
          ) : null}
        </Card>

        <div className="lg:sticky lg:top-6">
          <AiChatPreview messages={testHistory} senderLabel={name || "AI Agent"} />
        </div>
      </div>
    </div>
  );
}
