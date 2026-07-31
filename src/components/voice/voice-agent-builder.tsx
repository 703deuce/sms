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

export function VoiceAgentBuilder({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [section, setSection] = useState<string>("identity");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [error, setError] = useState<string | null>(null);
  const [phones, setPhones] = useState<Array<{ id: string; e164: string }>>([]);

  const load = useCallback(async () => {
    const [aRes, pRes] = await Promise.all([
      fetch(`/api/voice/agents/${agentId}`),
      fetch("/api/numbers"),
    ]);
    const aJson = await aRes.json();
    if (!aRes.ok) throw new Error(aJson.error || "Failed to load");
    setAgent(aJson.data);
    if (pRes.ok) {
      const pJson = await pRes.json();
      setPhones((pJson.data || []).map((p: { id: string; number?: string; e164?: string }) => ({
        id: p.id,
        e164: p.number || p.e164 || "",
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

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => saveDraft(), 2000);
    return () => clearTimeout(t);
  }, [dirty, agent]); // autosave debounced

  if (!agent && !error) return <p className="text-muted-foreground">Loading agent…</p>;
  if (!agent) return <p className="text-rose-600">{error}</p>;

  const cfg = agent.draftConfig;

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
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving} onClick={saveDraft}>Save</Button>
            <Button disabled={saving} onClick={publish}>Publish</Button>
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
              <Input
                value={cfg.voiceLanguage?.voiceId || ""}
                onChange={(e) =>
                  updateConfig({
                    voiceLanguage: { ...cfg.voiceLanguage, voiceId: e.target.value },
                  })
                }
              />
            </div>
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
          <Card className="p-5">
            <CardTitle>{SECTIONS.find((s) => s.id === section)?.label}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Configure {section} rules in workspace voice settings. Agent-level overrides
              are stored in draft config JSON.
            </p>
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
            <ul className="mt-2 space-y-1 text-sm">
              {agent.versions.map((v) => (
                <li key={v.id}>v{v.version} — {new Date(v.publishedAt).toLocaleString()}</li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
