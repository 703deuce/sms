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
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  DEFAULT_AI_ADVANCED,
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
import { Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const WIZARD_STEPS: WizardStep[] = [
  { id: "setup", label: "Setup", emoji: "⚙️", hint: "Name & number" },
  { id: "trigger", label: "Trigger", emoji: "🎯", hint: "When to reply" },
  { id: "knowledge", label: "Knowledge", emoji: "🧠", hint: "What it knows" },
  { id: "handoff", label: "Handoff", emoji: "🤝", hint: "Human takeover" },
  { id: "publish", label: "Test & Publish", emoji: "🚀", hint: "Go live" },
];

type Props = { mode?: "create" | "edit"; initial?: AiReplyRecord };

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

  return (
    <div className="mx-auto max-w-[1100px] px-1 pb-10 text-[13px]">
      <V1Breadcrumb
        items={[
          { label: "AI Agents", href: "/ai-replies" },
          { label: mode === "edit" ? "Edit agent" : "Create agent" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-[26px] font-bold tracking-tight text-foreground">
          {mode === "edit" ? `Edit ${name || "agent"}` : "Create AI agent"}
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          {mode === "edit"
            ? "Update triggers, knowledge, and handoff rules for this agent."
            : "Set up an AI teammate that answers texts with your brand voice."}
        </p>
      </div>

      <V1WizardStepper steps={WIZARD_STEPS} activeIndex={step} onStepClick={(i) => i < step && setStep(i)} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="rounded-[14px] border-border p-6 shadow-sm">
          {step === 0 ? (
            <div className="space-y-4">
              <V1WizardSection
                emoji="⚙️"
                title="Basic settings"
                description="Name your agent and choose which number it handles."
              />
              <div>
                <Label>AI Name</Label>
                <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="General AI Reply" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea className="mt-1" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Type</Label>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
              <div>
                <Label>Assigned inbox / phone number</Label>
                <select className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}>
                  <option value="">Select number</option>
                  {phones.map((p) => (
                    <option key={p.id} value={p.id}>{formatPhone(p.number)} — {p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <V1WizardSection
                emoji="🎯"
                title="Trigger condition"
                description="When should this AI agent take over the conversation?"
              />
              {(["all_incoming", "keywords", "segment"] as const).map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input type="radio" checked={trigger.mode === m} onChange={() => setTrigger((t) => ({ ...t, mode: m }))} />
                  {m === "all_incoming" ? "All incoming messages" : m === "keywords" ? "Messages containing keywords" : "Specific segment"}
                </label>
              ))}
              {trigger.mode === "keywords" ? (
                <div>
                  <div className="flex gap-2">
                    <Input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} placeholder="help, pricing" />
                    <Button type="button" variant="outline" onClick={() => {
                      if (!keywordInput.trim()) return;
                      setTrigger((t) => ({ ...t, keywords: [...(t.keywords || []), keywordInput.trim()] }));
                      setKeywordInput("");
                    }}>Add</Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(trigger.keywords || []).map((k) => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[12px]">
                        {k}
                        <button type="button" onClick={() => setTrigger((t) => ({ ...t, keywords: (t.keywords || []).filter((x) => x !== k) }))}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {trigger.mode === "segment" ? (
                <select className="h-10 w-full rounded-lg border border-slate-200 px-3" value={trigger.segmentId || ""} onChange={(e) => {
                  const seg = segments.find((s) => s.id === e.target.value);
                  setTrigger((t) => ({ ...t, segmentId: e.target.value, segmentName: seg?.name }));
                }}>
                  <option value="">Select segment</option>
                  {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : null}
              <div>
                <Label>Schedule</Label>
                <select className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" value={trigger.schedule || "always"} onChange={(e) => setTrigger((t) => ({ ...t, schedule: e.target.value as AiTriggerConfig["schedule"] }))}>
                  <option value="always">Always</option>
                  <option value="outside_hours">Outside business hours</option>
                  <option value="business_hours">During business hours only</option>
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Reply delay (seconds)</Label>
                  <Input type="number" min={0} value={advanced.replyDelaySec ?? 3} onChange={(e) => setAdvanced((a) => ({ ...a, replyDelaySec: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Max replies per contact</Label>
                  <Input type="number" min={1} value={advanced.maxRepliesPerContact ?? 10} onChange={(e) => setAdvanced((a) => ({ ...a, maxRepliesPerContact: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <Label>Creativity (temperature)</Label>
                <input type="range" min={0} max={1} step={0.1} className="mt-2 w-full" value={advanced.temperature ?? 0.5} onChange={(e) => setAdvanced((a) => ({ ...a, temperature: Number(e.target.value) }))} />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <V1WizardSection
                emoji="🧠"
                title="Knowledge & persona"
                description="Teach your agent how to speak and what it should know."
              />
              <div>
                <Label>Instructions (system prompt)</Label>
                <Textarea className="mt-1" rows={5} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="You are a helpful assistant for our business..." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Tone of voice</Label>
                  <select className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3" value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}>
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="sales">Sales-oriented</option>
                  </select>
                </div>
                <div>
                  <Label>Response length</Label>
                  <div className="mt-2 flex gap-2">
                    {(["short", "medium", "long"] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setResponseLength(l)}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold capitalize",
                          responseLength === l ? "border-primary bg-primary/5 text-primary" : "border-slate-200",
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label>Websites</Label>
                <div className="mt-1 flex gap-2">
                  <Input value={websiteInput} onChange={(e) => setWebsiteInput(e.target.value)} placeholder="https://yoursite.com" />
                  <Button type="button" variant="outline" onClick={() => {
                    if (!websiteInput.trim()) return;
                    setKnowledge((k) => ({ ...k, websites: [...(k.websites || []), websiteInput.trim()] }));
                    setWebsiteInput("");
                  }}><Plus className="h-4 w-4" /></Button>
                </div>
                <ul className="mt-2 space-y-1 text-[12px] text-slate-600">
                  {(knowledge.websites || []).map((w) => (
                    <li key={w} className="flex justify-between rounded border border-slate-100 px-2 py-1">
                      {w}
                      <button type="button" onClick={() => setKnowledge((k) => ({ ...k, websites: (k.websites || []).filter((x) => x !== w) }))}><Trash2 className="h-3 w-3" /></button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Label>Text snippets</Label>
                <Textarea rows={3} value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Business hours, pricing, policies..." />
                <Button type="button" variant="outline" className="mt-2" onClick={() => {
                  if (!textInput.trim()) return;
                  setKnowledge((k) => ({ ...k, textSnippets: [...(k.textSnippets || []), textInput.trim()] }));
                  setTextInput("");
                }}>Add snippet</Button>
              </div>
              <div>
                <Label>Q&A pairs</Label>
                <Input className="mt-1" placeholder="Question" value={qaQ} onChange={(e) => setQaQ(e.target.value)} />
                <Textarea className="mt-2" rows={2} placeholder="Answer" value={qaA} onChange={(e) => setQaA(e.target.value)} />
                <Button type="button" variant="outline" className="mt-2" onClick={() => {
                  if (!qaQ.trim() || !qaA.trim()) return;
                  setKnowledge((k) => ({ ...k, qaPairs: [...(k.qaPairs || []), { question: qaQ.trim(), answer: qaA.trim() }] }));
                  setQaQ(""); setQaA("");
                }}>Add Q&A</Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <V1WizardSection
                emoji="🤝"
                title="Lead capture & handoff"
                description="Define when a human should take over and what to collect."
              />
              <label className="flex items-center gap-2 font-semibold text-slate-900">
                <input type="checkbox" checked={lead.enabled} onChange={(e) => setLead((l) => ({ ...l, enabled: e.target.checked }))} />
                Lead capture
              </label>
              {lead.enabled ? (
                <div className="space-y-2 pl-6">
                  <label className="flex gap-2"><input type="checkbox" checked={lead.collectName !== false} onChange={(e) => setLead((l) => ({ ...l, collectName: e.target.checked }))} /> Name</label>
                  <label className="flex gap-2"><input type="checkbox" checked={lead.collectEmail} onChange={(e) => setLead((l) => ({ ...l, collectEmail: e.target.checked }))} /> Email</label>
                  <label className="flex gap-2"><input type="checkbox" checked={lead.collectPhone} onChange={(e) => setLead((l) => ({ ...l, collectPhone: e.target.checked }))} /> Phone</label>
                  <label className="flex gap-2"><input type="checkbox" checked={lead.collectCompany} onChange={(e) => setLead((l) => ({ ...l, collectCompany: e.target.checked }))} /> Company</label>
                  <Input placeholder="Notify email" value={lead.notifyEmail || ""} onChange={(e) => setLead((l) => ({ ...l, notifyEmail: e.target.value }))} />
                </div>
              ) : null}
              <label className="flex items-center gap-2 font-semibold text-slate-900">
                <input type="checkbox" checked={handoff.enabled !== false} onChange={(e) => setHandoff((h) => ({ ...h, enabled: e.target.checked }))} />
                Human handoff
              </label>
              {handoff.enabled !== false ? (
                <div className="space-y-2 pl-6">
                  <Input placeholder="Handoff keywords (comma separated)" value={(handoff.keywords || []).join(", ")} onChange={(e) => setHandoff((h) => ({ ...h, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) }))} />
                  <Input placeholder="Notify email" value={handoff.notifyEmail || ""} onChange={(e) => setHandoff((h) => ({ ...h, notifyEmail: e.target.value }))} />
                  <label className="flex gap-2"><input type="checkbox" checked={advanced.notifyAgentIfStuck !== false} onChange={(e) => setAdvanced((a) => ({ ...a, notifyAgentIfStuck: e.target.checked }))} /> Notify agent if AI is stuck</label>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <V1WizardSection
                emoji="🚀"
                title="Test your agent"
                description="Send test messages before publishing to production."
              />
              <div className="rounded-[12px] border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="font-semibold text-foreground">✅ Ready to publish</p>
                <p className="mt-1 text-[13px] text-muted-foreground">{name} · {triggerSummary(trigger)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <Label>Test chat</Label>
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                  {testHistory.map((m, i) => (
                    <div key={i} className={cn("rounded-lg px-3 py-2 text-[13px]", m.role === "user" ? "ml-8 bg-primary/10" : "mr-8 bg-slate-100")}>
                      {m.content}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input value={testInput} onChange={(e) => setTestInput(e.target.value)} placeholder="Type a test message..." onKeyDown={(e) => e.key === "Enter" && void runTest()} />
                  <Button type="button" disabled={testing} onClick={() => void runTest()}>Send</Button>
                </div>
                {testDebug.length ? (
                  <div className="mt-3 rounded border border-slate-100 bg-white p-2 text-[12px] text-slate-500">
                    <p className="font-semibold">Debug — knowledge used</p>
                    {testDebug.map((d, i) => <p key={i}>{d}</p>)}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-rose-600">{error}</p> : null}

          <V1WizardFooter
            onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
            onCancel={step === 0 ? () => router.push("/ai-replies") : undefined}
            onNext={
              step < 4
                ? () => setStep((s) => s + 1)
                : () => void save(true)
            }
            nextLabel={step === 4 ? (saving ? "Publishing…" : "🚀 Publish agent") : "Next →"}
            nextDisabled={
              step === 0
                ? !name.trim() || !phoneNumberId
                : step === 2
                  ? !systemPrompt.trim()
                  : step === 4 && saving
            }
            nextLoading={step === 4 && saving}
            extraActions={
              step === 4 ? (
                <Button type="button" variant="outline" disabled={saving} onClick={() => void save(false)}>
                  Save as Draft
                </Button>
              ) : undefined
            }
          />
        </Card>

        {step === 4 ? (
          <Card className="h-fit rounded-xl border-slate-200 p-4 shadow-sm lg:sticky lg:top-6">
            <p className="mb-2 text-[12px] font-semibold text-slate-500">Debug log</p>
            {testDebug.length ? (
              testDebug.map((d, i) => (
                <p key={i} className="text-[12px] text-slate-600">
                  {d}
                </p>
              ))
            ) : (
              <p className="text-[12px] text-slate-400">Run a test message to see context</p>
            )}
          </Card>
        ) : (
          <AiChatPreview
            messages={testHistory}
            senderLabel={selectedPhone?.number}
            className="lg:sticky lg:top-6"
          />
        )}
      </div>
    </div>
  );
}
