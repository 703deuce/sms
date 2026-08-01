"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { AGENT_TYPE_LABELS } from "@/lib/voice/types";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "instructions", label: "Instructions" },
  { id: "conversationFlow", label: "Conversation Flow" },
  { id: "voiceLanguage", label: "Voice & Language" },
  { id: "knowledge", label: "Knowledge" },
  { id: "tools", label: "Tools" },
  { id: "model", label: "Model" },
  { id: "transfers", label: "Transfers" },
  { id: "voicemail", label: "Voicemail" },
  { id: "postCall", label: "Post-Call" },
  { id: "compliance", label: "Compliance" },
] as const;

type AgentDetail = {
  id: string;
  name: string;
  description?: string | null;
  agentType: string;
  status: string;
  rawStatus: string;
  displayName?: string | null;
  purpose?: string | null;
  phoneNumberId?: string | null;
  directions: string[];
  draftConfig: VoiceAgentConfig;
  publishedVersionId?: string | null;
  versions?: Array<{ id: string; version: number; publishedAt: string }>;
};

type KbOption = { id: string; name: string; status: string };
type ToolOption = { id: string; name: string; toolType: string; status: string };

export function VoiceAgentBuilder({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [section, setSection] = useState<string>("identity");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [phones, setPhones] = useState<Array<{ id: string; e164: string }>>([]);
  const [kbOptions, setKbOptions] = useState<KbOption[]>([]);
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([]);
  const [toolOptions, setToolOptions] = useState<ToolOption[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [agentOptions, setAgentOptions] = useState<Array<{ id: string; name: string; telnyxAssistantId?: string | null }>>([]);
  const [pronDictText, setPronDictText] = useState("{}");
  const [linkSaving, setLinkSaving] = useState(false);

  const load = useCallback(async () => {
    const [aRes, pRes, kbRes, agentKbRes, toolsRes, agentToolsRes, agentsRes] = await Promise.all([
      fetch(`/api/voice/agents/${agentId}`),
      fetch("/api/numbers"),
      fetch("/api/voice/knowledge"),
      fetch(`/api/voice/agents/${agentId}/knowledge`),
      fetch("/api/voice/tools"),
      fetch(`/api/voice/agents/${agentId}/tools`),
      fetch("/api/voice/agents"),
    ]);
    const aJson = await aRes.json();
    if (!aRes.ok) throw new Error(aJson.error || "Failed to load");
    setAgent(aJson.data);
    setPronDictText(
      JSON.stringify(aJson.data.draftConfig?.voiceLanguage?.pronunciationDictionary || {}, null, 2),
    );

    if (pRes.ok) {
      const pJson = await pRes.json();
      setPhones((pJson.data || []).map((p: { id: string; number?: string; e164?: string }) => ({
        id: p.id,
        e164: p.number || p.e164 || "",
      })));
    }
    if (kbRes.ok) {
      const kbJson = await kbRes.json();
      setKbOptions(kbJson.data || []);
    }
    if (agentKbRes.ok) {
      const j = await agentKbRes.json();
      setSelectedKbIds((j.data || []).map((l: { knowledgeBaseId: string }) => l.knowledgeBaseId));
    }
    if (toolsRes.ok) {
      const tJson = await toolsRes.json();
      setToolOptions(tJson.data || []);
    }
    if (agentToolsRes.ok) {
      const j = await agentToolsRes.json();
      setSelectedToolIds((j.data || []).map((l: { toolId: string }) => l.toolId));
    }
    if (agentsRes.ok) {
      const j = await agentsRes.json();
      setAgentOptions((j.data || []).map((a: { id: string; name: string; telnyxAssistantId?: string | null }) => ({
        id: a.id,
        name: a.name,
        telnyxAssistantId: a.telnyxAssistantId,
      })));
    }
  }, [agentId]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [load]);

  function updateConfig(patch: Partial<VoiceAgentConfig>) {
    if (!agent) return;
    setAgent({
      ...agent,
      draftConfig: { ...agent.draftConfig, ...patch },
    });
    setDirty(true);
    setSaveState("unsaved");
  }

  async function saveDraft() {
    if (!agent) return;
    setSaving(true);
    setSaveState("saving");
    try {
      const res = await fetch(`/api/voice/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agent.name,
          description: agent.description,
          agentType: agent.agentType,
          displayName: agent.displayName,
          purpose: agent.purpose,
          phoneNumberId: agent.phoneNumberId,
          draftConfig: agent.draftConfig,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAgent(json.data);
      setDirty(false);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    await saveDraft();
    const res = await fetch(`/api/voice/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Publish failed");
      if (json.issues) setError(`Publish blocked: ${JSON.stringify(json.issues)}`);
      return;
    }
    await load();
  }

  async function agentAction(action: string, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/voice/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || `${action} failed`);
      return;
    }
    if (action === "duplicate") {
      window.location.href = `/voice/agents/${json.data.id}`;
      return;
    }
    await load();
  }

  async function saveKnowledgeBases() {
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/voice/agents/${agentId}/knowledge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeBaseIds: selectedKbIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Knowledge save failed");
    } finally {
      setLinkSaving(false);
    }
  }

  async function saveTools() {
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/voice/agents/${agentId}/tools`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolIds: selectedToolIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tools save failed");
    } finally {
      setLinkSaving(false);
    }
  }

  function toggleKbId(id: string) {
    setSelectedKbIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleToolId(id: string) {
    setSelectedToolIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function updateDirections(dir: "inbound" | "outbound", checked: boolean) {
    if (!agent) return;
    const current = agent.draftConfig.identity?.directions || agent.directions || [];
    const next = checked
      ? [...new Set([...current, dir])]
      : current.filter((d) => d !== dir);
    updateConfig({
      identity: { ...agent.draftConfig.identity, directions: next as ("inbound" | "outbound")[] },
    });
  }

  function updatePronDict(text: string) {
    setPronDictText(text);
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === "object" && parsed !== null) {
        updateConfig({
          voiceLanguage: {
            ...agent?.draftConfig.voiceLanguage,
            pronunciationDictionary: parsed as Record<string, string>,
          },
        });
      }
    } catch {
      // wait for valid JSON
    }
  }

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveDraft(), 2000);
    return () => clearTimeout(t);
  }, [dirty, agent]); // autosave debounced

  if (!agent && !error) return <p className="text-muted-foreground">Loading agent…</p>;
  if (!agent) return <p className="text-rose-600">{error}</p>;

  const cfg = agent.draftConfig;
  const directions = cfg.identity?.directions || agent.directions || [];
  const greeting =
    (cfg.callHandling?.greeting as string | undefined) || "";

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Card className="w-full shrink-0 p-3 lg:w-56">
        <p className="mb-2 px-2 text-xs font-medium uppercase text-muted-foreground">Sections</p>
        <nav className="space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-sm",
                section === s.id ? "bg-muted font-medium" : "hover:bg-muted/60",
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="mt-4 border-t border-border pt-3 px-2 text-xs text-muted-foreground">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "unsaved" && "Unsaved changes"}
          {saveState === "error" && "Save error"}
          {agent.publishedVersionId ? (
            <p className="mt-1 text-emerald-600">Published</p>
          ) : (
            <p className="mt-1">Draft only</p>
          )}
        </div>
      </Card>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{agent.name}</h2>
            <p className="text-sm text-muted-foreground">Status: {agent.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={saving} onClick={saveDraft}>Save</Button>
            <Button disabled={saving} onClick={publish}>Publish</Button>
            {agent.rawStatus === "ACTIVE" ? (
              <Button variant="outline" size="sm" onClick={() => agentAction("pause")}>Pause</Button>
            ) : agent.rawStatus === "PAUSED" ? (
              <Button variant="outline" size="sm" onClick={() => agentAction("activate")}>Activate</Button>
            ) : null}
            {agent.rawStatus !== "ARCHIVED" ? (
              <Button variant="outline" size="sm" onClick={() => agentAction("archive")}>Archive</Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => agentAction("duplicate")}>Duplicate</Button>
          </div>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {section === "identity" && (
          <Card className="space-y-4 p-5">
            <CardTitle>Identity</CardTitle>
            <div>
              <Label>Agent name</Label>
              <Input value={agent.name} onChange={(e) => {
                setAgent({ ...agent, name: e.target.value });
                setDirty(true);
              }} />
            </div>
            <div>
              <Label>Display name on calls</Label>
              <Input
                value={agent.displayName || ""}
                onChange={(e) => {
                  setAgent({ ...agent, displayName: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <Label>Agent type</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                value={agent.agentType}
                onChange={(e) => {
                  setAgent({ ...agent, agentType: e.target.value });
                  setDirty(true);
                }}
              >
                {Object.entries(AGENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Call directions</Label>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={directions.includes("inbound")}
                    onChange={(e) => updateDirections("inbound", e.target.checked)}
                  />
                  Inbound
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={directions.includes("outbound")}
                    onChange={(e) => updateDirections("outbound", e.target.checked)}
                  />
                  Outbound
                </label>
              </div>
            </div>
            <div>
              <Label>Default phone number</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                value={agent.phoneNumberId || ""}
                onChange={(e) => {
                  setAgent({ ...agent, phoneNumberId: e.target.value || null });
                  setDirty(true);
                }}
              >
              <option value="">Select number</option>
              {phones.map((p) => (
                <option key={p.id} value={p.id}>{p.e164}</option>
              ))}
            </select>
            {!phones.length && (
              <p className="mt-1 text-xs text-muted-foreground">
                No numbers in workspace. Add one under Phone Numbers.
              </p>
            )}
            </div>
            <div>
              <Label>Greeting</Label>
              <Textarea
                rows={2}
                value={greeting}
                onChange={(e) =>
                  updateConfig({
                    callHandling: { ...cfg.callHandling, greeting: e.target.value },
                  })
                }
                placeholder="Thank you for calling. How can I help you today?"
              />
            </div>
            <div>
              <Label>Purpose</Label>
              <Textarea
                rows={3}
                value={agent.purpose || ""}
                onChange={(e) => {
                  setAgent({ ...agent, purpose: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
          </Card>
        )}

        {section === "instructions" && (
          <Card className="space-y-4 p-5">
            <CardTitle>Instructions</CardTitle>
            <div>
              <Label>Role</Label>
              <Input
                value={cfg.instructions?.role || ""}
                onChange={(e) =>
                  updateConfig({
                    instructions: { ...cfg.instructions, role: e.target.value },
                  })
                }
                placeholder="e.g. receptionist, sales assistant"
              />
            </div>
            <div>
              <Label>System instructions</Label>
              <Textarea
                rows={6}
                value={cfg.instructions?.system || ""}
                onChange={(e) =>
                  updateConfig({
                    instructions: { ...cfg.instructions, system: e.target.value },
                  })
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tone</Label>
                <Input
                  value={cfg.instructions?.tone || ""}
                  onChange={(e) =>
                    updateConfig({
                      instructions: { ...cfg.instructions, tone: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label>Style</Label>
                <Input
                  value={cfg.instructions?.style || ""}
                  onChange={(e) =>
                    updateConfig({
                      instructions: { ...cfg.instructions, style: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label>Response length</Label>
                <Input
                  value={cfg.instructions?.responseLength || ""}
                  onChange={(e) =>
                    updateConfig({
                      instructions: { ...cfg.instructions, responseLength: e.target.value },
                    })
                  }
                  placeholder="short, medium, long"
                />
              </div>
              <div>
                <Label>Pronunciation notes</Label>
                <Input
                  value={cfg.instructions?.pronunciation || ""}
                  onChange={(e) =>
                    updateConfig({
                      instructions: { ...cfg.instructions, pronunciation: e.target.value },
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Goals</Label>
              <Textarea
                rows={3}
                value={cfg.instructions?.goals || ""}
                onChange={(e) =>
                  updateConfig({
                    instructions: { ...cfg.instructions, goals: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <Label>Prohibited behavior</Label>
              <Textarea
                rows={3}
                placeholder="Never claim an action succeeded without confirmation…"
                value={cfg.instructions?.prohibited?.join("\n") || ""}
                onChange={(e) =>
                  updateConfig({
                    instructions: {
                      ...cfg.instructions,
                      prohibited: e.target.value.split("\n").filter(Boolean),
                    },
                  })
                }
              />
            </div>
            <div>
              <Label>Advanced raw instructions</Label>
              <Textarea
                rows={5}
                value={cfg.instructions?.raw || ""}
                onChange={(e) =>
                  updateConfig({
                    instructions: { ...cfg.instructions, raw: e.target.value },
                  })
                }
              />
            </div>
          </Card>
        )}

        {section === "conversationFlow" && (
          <Card className="space-y-3 p-5">
            <CardTitle>Conversation flow</CardTitle>
            {(cfg.conversationFlow?.sections || []).map((sec) => (
              <label key={sec.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sec.enabled}
                  onChange={(e) => {
                    const sections = cfg.conversationFlow!.sections.map((s) =>
                      s.id === sec.id ? { ...s, enabled: e.target.checked } : s,
                    );
                    updateConfig({
                      conversationFlow: { sections },
                    });
                  }}
                />
                {sec.label}
              </label>
            ))}
          </Card>
        )}

        {section === "voiceLanguage" && (
          <Card className="space-y-4 p-5">
            <CardTitle>Voice & language</CardTitle>
            <div>
              <Label>Voice ID (Telnyx)</Label>
              <div className="flex gap-2">
                <Input
                  value={cfg.voiceLanguage?.voiceId || ""}
                  onChange={(e) =>
                    updateConfig({
                      voiceLanguage: { ...cfg.voiceLanguage, voiceId: e.target.value },
                    })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/voice/tts-preview", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          voice: cfg.voiceLanguage?.voiceId || undefined,
                          text: "Hello, this is a preview of your AI voice agent.",
                        }),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || "Preview failed");
                      if (json.data?.audioUrl) {
                        const audio = new Audio(json.data.audioUrl);
                        await audio.play().catch(() => undefined);
                      } else {
                        alert(
                          json.data?.message ||
                            `Preview ready (${json.data?.mode}). Text: ${json.data?.text}`,
                        );
                      }
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Preview failed");
                    }
                  }}
                >
                  Preview
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Speaking speed</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="2"
                  value={cfg.voiceLanguage?.speed ?? 1}
                  onChange={(e) =>
                    updateConfig({
                      voiceLanguage: {
                        ...cfg.voiceLanguage,
                        speed: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label>Silence timeout (ms)</Label>
                <Input
                  type="number"
                  min="1000"
                  step="500"
                  value={cfg.voiceLanguage?.silenceTimeoutMs ?? 8000}
                  onChange={(e) =>
                    updateConfig({
                      voiceLanguage: {
                        ...cfg.voiceLanguage,
                        silenceTimeoutMs: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label>Interruption handling</Label>
                <Input
                  value={cfg.voiceLanguage?.interruptionHandling || ""}
                  onChange={(e) =>
                    updateConfig({
                      voiceLanguage: {
                        ...cfg.voiceLanguage,
                        interruptionHandling: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. polite, assertive"
                />
              </div>
              <div>
                <Label>Responsiveness</Label>
                <Input
                  value={cfg.voiceLanguage?.responsiveness || ""}
                  onChange={(e) =>
                    updateConfig({
                      voiceLanguage: {
                        ...cfg.voiceLanguage,
                        responsiveness: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. fast, balanced"
                />
              </div>
            </div>
            <div>
              <Label>Primary language</Label>
              <Input
                value={cfg.voiceLanguage?.primaryLanguage || "en-US"}
                onChange={(e) =>
                  updateConfig({
                    voiceLanguage: {
                      ...cfg.voiceLanguage,
                      primaryLanguage: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <Label>Additional languages (comma-separated)</Label>
              <Input
                value={(cfg.voiceLanguage?.additionalLanguages || []).join(", ")}
                onChange={(e) =>
                  updateConfig({
                    voiceLanguage: {
                      ...cfg.voiceLanguage,
                      additionalLanguages: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                placeholder="es-US, fr-FR"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.voiceLanguage?.autoLanguageDetection ?? false}
                onChange={(e) =>
                  updateConfig({
                    voiceLanguage: {
                      ...cfg.voiceLanguage,
                      autoLanguageDetection: e.target.checked,
                    },
                  })
                }
              />
              Auto language detection
            </label>
            <div>
              <Label>Pronunciation dictionary (JSON)</Label>
              <Textarea
                rows={5}
                className="font-mono text-xs"
                value={pronDictText}
                onChange={(e) => updatePronDict(e.target.value)}
                placeholder='{"Telnyx": "tell-nicks"}'
              />
            </div>
          </Card>
        )}

        {section === "knowledge" && (
          <Card className="space-y-4 p-5">
            <CardTitle>Knowledge bases</CardTitle>
            <p className="text-sm text-muted-foreground">
              Link knowledge bases for RAG retrieval during calls.
            </p>
            {kbOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No knowledge bases yet.</p>
            ) : (
              <div className="space-y-2">
                {kbOptions.map((kb) => (
                  <label key={kb.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedKbIds.includes(kb.id)}
                      onChange={() => toggleKbId(kb.id)}
                    />
                    {kb.name}
                    <span className="text-muted-foreground">({kb.status})</span>
                  </label>
                ))}
              </div>
            )}
            <Button disabled={linkSaving} onClick={saveKnowledgeBases}>
              {linkSaving ? "Saving…" : "Save knowledge links"}
            </Button>
          </Card>
        )}

        {section === "tools" && (
          <Card className="space-y-4 p-5">
            <CardTitle>Tools</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enable tools the agent can invoke during conversations.
            </p>
            {toolOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tools configured yet.</p>
            ) : (
              <div className="space-y-2">
                {toolOptions.map((tool) => (
                  <label key={tool.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedToolIds.includes(tool.id)}
                      onChange={() => toggleToolId(tool.id)}
                    />
                    {tool.name}
                    <span className="text-muted-foreground">
                      ({tool.toolType} · {tool.status})
                    </span>
                  </label>
                ))}
              </div>
            )}
            <Button disabled={linkSaving} onClick={saveTools}>
              {linkSaving ? "Saving…" : "Save tool links"}
            </Button>
          </Card>
        )}

        {section === "model" && (
          <Card className="space-y-4 p-5">
            <CardTitle>Model</CardTitle>
            <div>
              <Label>Model ID</Label>
              <Input
                value={cfg.model?.modelId || ""}
                onChange={(e) =>
                  updateConfig({ model: { ...cfg.model, modelId: e.target.value } })
                }
              />
            </div>
            <div>
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={cfg.model?.temperature ?? 0.4}
                onChange={(e) =>
                  updateConfig({
                    model: { ...cfg.model, temperature: Number(e.target.value) },
                  })
                }
              />
            </div>
          </Card>
        )}

        {(section === "transfers" || section === "voicemail" || section === "compliance") && (
          <Card className="space-y-4 p-5">
            <CardTitle>{SECTIONS.find((s) => s.id === section)?.label}</CardTitle>

            {section === "transfers" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Transfer targets and handoff assistants sync to Telnyx on publish.
                </p>
                <div>
                  <Label>Transfer targets</Label>
                  {(cfg.transfers?.targets as Array<{ name: string; to: string }> | undefined)?.map((t, i) => (
                    <div key={i} className="mt-2 flex flex-wrap gap-2">
                      <Input
                        placeholder="Name (e.g. Sales)"
                        value={t.name}
                        onChange={(e) => {
                          const targets = [...((cfg.transfers?.targets as Array<{ name: string; to: string }>) || [])];
                          targets[i] = { ...targets[i], name: e.target.value };
                          updateConfig({ transfers: { ...cfg.transfers, targets } });
                        }}
                      />
                      <Input
                        placeholder="+1… or sip URI"
                        value={t.to}
                        onChange={(e) => {
                          const targets = [...((cfg.transfers?.targets as Array<{ name: string; to: string }>) || [])];
                          targets[i] = { ...targets[i], to: e.target.value };
                          updateConfig({ transfers: { ...cfg.transfers, targets } });
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const targets = ((cfg.transfers?.targets as Array<{ name: string; to: string }>) || []).filter((_, j) => j !== i);
                          updateConfig({ transfers: { ...cfg.transfers, targets } });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const targets = [...((cfg.transfers?.targets as Array<{ name: string; to: string }>) || []), { name: "", to: "" }];
                      updateConfig({ transfers: { ...cfg.transfers, targets } });
                    }}
                  >
                    Add target
                  </Button>
                </div>
                <div>
                  <Label>Handoff assistants</Label>
                  {(cfg.transfers?.handoffAssistants as Array<{ name: string; id: string }> | undefined)?.map((h, i) => (
                    <div key={i} className="mt-2 flex flex-wrap gap-2">
                      <Input
                        placeholder="Label"
                        value={h.name}
                        onChange={(e) => {
                          const handoffAssistants = [...((cfg.transfers?.handoffAssistants as Array<{ name: string; id: string }>) || [])];
                          handoffAssistants[i] = { ...handoffAssistants[i], name: e.target.value };
                          updateConfig({ transfers: { ...cfg.transfers, handoffAssistants } });
                        }}
                      />
                      <select
                        className="rounded-lg border border-border px-3 py-2 text-sm"
                        value={h.id}
                        onChange={(e) => {
                          const handoffAssistants = [...((cfg.transfers?.handoffAssistants as Array<{ name: string; id: string }>) || [])];
                          const picked = agentOptions.find((a) => a.telnyxAssistantId === e.target.value || a.id === e.target.value);
                          handoffAssistants[i] = {
                            name: handoffAssistants[i].name || picked?.name || "",
                            id: e.target.value,
                          };
                          updateConfig({ transfers: { ...cfg.transfers, handoffAssistants } });
                        }}
                      >
                        <option value="">Select agent / assistant id</option>
                        {agentOptions.map((a) => (
                          <option key={a.id} value={a.telnyxAssistantId || a.id}>
                            {a.name}{a.telnyxAssistantId ? ` (${a.telnyxAssistantId})` : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const handoffAssistants = ((cfg.transfers?.handoffAssistants as Array<{ name: string; id: string }>) || []).filter((_, j) => j !== i);
                          updateConfig({ transfers: { ...cfg.transfers, handoffAssistants } });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const handoffAssistants = [...((cfg.transfers?.handoffAssistants as Array<{ name: string; id: string }>) || []), { name: "", id: "" }];
                      updateConfig({ transfers: { ...cfg.transfers, handoffAssistants } });
                    }}
                  >
                    Add handoff
                  </Button>
                </div>
                <div>
                  <Label>Warm transfer instructions</Label>
                  <Textarea
                    rows={3}
                    value={(cfg.transfers?.warmTransferInstructions as string) || ""}
                    onChange={(e) =>
                      updateConfig({
                        transfers: { ...cfg.transfers, warmTransferInstructions: e.target.value },
                      })
                    }
                    placeholder="Briefly introduce the caller and summarize why they are calling…"
                  />
                </div>
              </>
            )}

            {section === "voicemail" && (
              <>
                <div>
                  <Label>Voicemail action</Label>
                  <select
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                    value={(cfg.voicemail?.action as string) || "record"}
                    onChange={(e) =>
                      updateConfig({ voicemail: { ...cfg.voicemail, action: e.target.value } })
                    }
                  >
                    <option value="record">Record message</option>
                    <option value="hangup">Hang up</option>
                    <option value="callback">Request callback</option>
                  </select>
                </div>
                <div>
                  <Label>Greeting text</Label>
                  <Textarea
                    rows={3}
                    value={(cfg.voicemail?.greetingText as string) || ""}
                    onChange={(e) =>
                      updateConfig({ voicemail: { ...cfg.voicemail, greetingText: e.target.value } })
                    }
                    placeholder="Please leave a message after the tone…"
                  />
                </div>
              </>
            )}

            {section === "compliance" && (
              <>
                <div>
                  <Label>Recording disclosure (spoken before AI starts)</Label>
                  <Textarea
                    rows={3}
                    value={(cfg.compliance?.recordingDisclosureText as string) || ""}
                    onChange={(e) =>
                      updateConfig({
                        compliance: { ...cfg.compliance, recordingDisclosureText: e.target.value },
                      })
                    }
                    placeholder="This call may be recorded for quality and training purposes."
                  />
                </div>
                <div>
                  <Label>After-hours behavior</Label>
                  <select
                    className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                    value={(cfg.compliance?.afterHoursBehavior as string) || "ai_answer"}
                    onChange={(e) =>
                      updateConfig({
                        compliance: { ...cfg.compliance, afterHoursBehavior: e.target.value },
                      })
                    }
                  >
                    <option value="ai_answer">AI answers</option>
                    <option value="human_first">Humans first, AI fallback</option>
                    <option value="voicemail">Voicemail</option>
                    <option value="hangup">Hang up</option>
                  </select>
                </div>
              </>
            )}
          </Card>
        )}

        {section === "postCall" && (
          <Card className="space-y-4 p-5">
            <CardTitle>Lead scoring rules</CardTitle>
            {(cfg.postCall?.scoringRules || []).map((rule, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="font-mono">{rule.field}</span>
                <span>{rule.points} pts</span>
              </div>
            ))}
          </Card>
        )}

        {agent.versions?.length ? (
          <Card className="p-5">
            <CardTitle>Version history</CardTitle>
            <ul className="mt-2 space-y-2 text-sm">
              {agent.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>v{v.version} — {new Date(v.publishedAt).toLocaleString()}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => agentAction("rollback", { versionId: v.id })}
                  >
                    Rollback
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
