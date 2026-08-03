"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { AgentBrowserCall } from "@/components/voice/agent-browser-call";
import { AgentTestPanel } from "@/components/voice/agent-test-panel";
import { VoicePicker } from "@/components/voice/voice-picker";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { AGENT_TYPE_LABELS } from "@/lib/voice/types";
import {
  TOOL_CATEGORY_LABELS,
  TOOL_CATEGORY_ORDER,
  TOOL_CATALOG,
  defaultBuiltinToolsForAgentType,
  type CatalogToolDef,
} from "@/lib/voice/tools/catalog";
import { VoiceFlowBuilder } from "@/components/voice/flow-builder/voice-flow-builder";
import { toErrorMessage } from "@/lib/errors";
import { isUltraVoice, voiceLabel } from "@/lib/voice/telnyx/voices";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";

const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "instructions", label: "Instructions" },
  { id: "flow", label: "Visual Flow" },
  { id: "conversationFlow", label: "Flow sections" },
  { id: "voiceLanguage", label: "Voice & Language" },
  { id: "transcription", label: "Transcription" },
  { id: "knowledge", label: "Knowledge" },
  { id: "tools", label: "Tools" },
  { id: "model", label: "Model" },
  { id: "transfers", label: "Transfers" },
  { id: "voicemail", label: "Voicemail" },
  { id: "messaging", label: "SMS" },
  { id: "memory", label: "Memory" },
  { id: "mcp", label: "MCP" },
  { id: "insights", label: "Insights" },
  { id: "tests", label: "Text debug" },
  { id: "versions", label: "Versions" },
  { id: "canary", label: "Canary" },
  { id: "scheduled", label: "Scheduled" },
  { id: "observability", label: "Observability" },
  { id: "postCall", label: "Post-Call" },
  { id: "compliance", label: "Compliance" },
  { id: "security", label: "Security" },
  { id: "platform", label: "AI Platform" },
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
  telnyxAssistantId?: string | null;
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
  const [enabledBuiltinTools, setEnabledBuiltinTools] = useState<string[]>([]);
  const [agentOptions, setAgentOptions] = useState<Array<{ id: string; name: string; telnyxAssistantId?: string | null }>>([]);
  const [pronDictText, setPronDictText] = useState("{}");
  const [linkSaving, setLinkSaving] = useState(false);
  const [platformMsg, setPlatformMsg] = useState("");
  const [platformBusy, setPlatformBusy] = useState("");
  const [platformFlags, setPlatformFlags] = useState({
    emergencyDisabled: false,
    multiPartyEnabled: false,
    outboundAiEnabled: false,
    widgetEnabled: false,
  });
  const [destName, setDestName] = useState("Front desk");
  const [destNumber, setDestNumber] = useState("+1");
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [memoryMode, setMemoryMode] = useState("conversation");
  const [canaryPct, setCanaryPct] = useState(10);
  const [remoteVersions, setRemoteVersions] = useState<
    Array<{ telnyxVersionId: string; name?: string | null; label?: string | null; isMain?: boolean }>
  >([]);
  const [canaryVersionId, setCanaryVersionId] = useState("main");
  const [compareLeft, setCompareLeft] = useState("");
  const [compareRight, setCompareRight] = useState("");
  const [compareResult, setCompareResult] = useState<{
    diffCount?: number;
    diffs?: Array<{ key: string; left: unknown; right: unknown }>;
  } | null>(null);

  const loadPlatform = useCallback(async () => {
    const res = await fetch(`/api/voice/ai?view=agent&agentId=${agentId}`);
    if (!res.ok) return;
    const j = await res.json();
    const a = j.data;
    if (!a) return;
    setPlatformFlags({
      emergencyDisabled: Boolean(a.emergencyDisabled),
      multiPartyEnabled: Boolean(a.multiPartyEnabled),
      outboundAiEnabled: Boolean(a.outboundAiEnabled),
      widgetEnabled: Boolean(a.widgetEnabled),
    });
  }, [agentId]);

  const loadRemoteVersions = useCallback(async () => {
    const res = await fetch(`/api/voice/ai?view=versions&agentId=${agentId}`);
    if (!res.ok) return;
    const j = await res.json();
    const rows = (j.data || []) as Array<{
      telnyxVersionId: string;
      name?: string | null;
      label?: string | null;
      isMain?: boolean;
    }>;
    setRemoteVersions(rows);
    setCanaryVersionId((prev) => {
      if (prev && prev !== "main") return prev;
      const main = rows.find((r) => r.isMain) || rows[0];
      return main?.telnyxVersionId || prev || "main";
    });
    setCompareLeft((prev) => prev || rows[0]?.telnyxVersionId || "");
    setCompareRight((prev) => prev || rows[1]?.telnyxVersionId || rows[0]?.telnyxVersionId || "");
  }, [agentId]);

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
    if (!aRes.ok) throw new Error(toErrorMessage(aJson.error ?? aJson, "Failed to load"));
    setAgent(aJson.data);
    void loadPlatform();
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
      if (Array.isArray(j.enabledBuiltinTools)) {
        setEnabledBuiltinTools(j.enabledBuiltinTools);
      } else {
        setEnabledBuiltinTools(
          defaultBuiltinToolsForAgentType(aJson.data?.agentType),
        );
      }
    }
    if (agentsRes.ok) {
      const j = await agentsRes.json();
      setAgentOptions((j.data || []).map((a: { id: string; name: string; telnyxAssistantId?: string | null }) => ({
        id: a.id,
        name: a.name,
        telnyxAssistantId: a.telnyxAssistantId,
      })));
    }
  }, [agentId, loadPlatform]);

  useEffect(() => {
    load().catch((e) => setError(toErrorMessage(e, "Load failed")));
  }, [load]);

  useEffect(() => {
    void loadRemoteVersions();
  }, [loadRemoteVersions]);

  async function platformAct(action: string, extra: Record<string, unknown> = {}) {
    setPlatformBusy(action);
    setPlatformMsg("");
    try {
      const res = await fetch("/api/voice/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, agentId, ...extra }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(toErrorMessage(j.error ?? j, `Failed ${action}`));
      if (action === "compare_versions") {
        setCompareResult(j.data || null);
        setPlatformMsg(`compare_versions: ${j.data?.diffCount ?? 0} diffs`);
      } else {
        setPlatformMsg(`${action}: ok`);
      }
      await loadPlatform();
      if (action === "sync_versions") await loadRemoteVersions();
    } catch (err) {
      setPlatformMsg(toErrorMessage(err, `${action} failed`));
    } finally {
      setPlatformBusy("");
    }
  }

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
    if (!agent) throw new Error("Agent not loaded");
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
      if (!res.ok) throw new Error(toErrorMessage(json.error ?? json, "Save failed"));
      setAgent(json.data);
      setDirty(false);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      const msg = toErrorMessage(err, "Save failed");
      setError(msg);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function buildForTest() {
    setSaving(true);
    setError(null);
    try {
      await saveDraft();
      await saveKnowledgeBases();
      await saveTools();
      const res = await fetch(`/api/voice/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "build_for_test" }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.issues) {
          setError(`Build blocked: ${JSON.stringify(json.issues)}`);
        } else {
          setError(toErrorMessage(json.error ?? json, "Build failed"));
        }
        return;
      }
      // Stay on the builder — Test Voice Agent is always at the top.
      await load();
    } catch (err) {
      setError(toErrorMessage(err, "Build failed"));
    } finally {
      setSaving(false);
    }
  }

  async function deploy() {
    setSaving(true);
    setError(null);
    try {
      await saveDraft();
      const res = await fetch(`/api/voice/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deploy" }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.issues) {
          setError(`Deploy blocked: ${JSON.stringify(json.issues)}`);
        } else {
          setError(toErrorMessage(json.error ?? json, "Deploy failed"));
        }
        return;
      }
      await load();
    } catch (err) {
      setError(toErrorMessage(err, "Deploy failed"));
    } finally {
      setSaving(false);
    }
  }

  async function agentAction(action: string, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/voice/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(toErrorMessage(json.error ?? json, `${action} failed`));
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
      if (!res.ok) throw new Error(toErrorMessage(json.error ?? json, "Save failed"));
    } catch (e) {
      setError(toErrorMessage(e, "Knowledge save failed"));
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
        body: JSON.stringify({
          toolIds: selectedToolIds,
          enabledBuiltinTools,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(toErrorMessage(json.error ?? json, "Save failed"));
      if (agent) {
        setAgent({
          ...agent,
          draftConfig: {
            ...agent.draftConfig,
            toolIds: selectedToolIds,
            enabledBuiltinTools,
          },
        });
      }
    } catch (e) {
      setError(toErrorMessage(e, "Tools save failed"));
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

  function toggleBuiltinTool(key: string) {
    setEnabledBuiltinTools((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }

  const catalogGroups = useMemo(() => {
    return TOOL_CATEGORY_ORDER.map((category) => ({
      category,
      label: TOOL_CATEGORY_LABELS[category],
      tools: TOOL_CATALOG.filter((t) => t.category === category),
    })).filter((g) => g.tools.length > 0);
  }, []);

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
    const t = setTimeout(() => {
      void saveDraft().catch(() => undefined);
    }, 2000);
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
          {agent.rawStatus === "ACTIVE" ? (
            <p className="mt-1 text-emerald-600">Deployed live</p>
          ) : agent.rawStatus === "TESTING" ? (
            <p className="mt-1 text-amber-700">Built — test before deploy</p>
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
            <Button variant="outline" disabled={saving} onClick={saveDraft}>
              Save draft
            </Button>
            <Button disabled={saving} onClick={() => void buildForTest()}>
              Build &amp; test
            </Button>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => void deploy()}
              title="Requires a phone number for inbound — goes live on that DID"
            >
              Deploy to number
            </Button>
            {agent.rawStatus === "ACTIVE" ? (
              <Button variant="outline" size="sm" onClick={() => agentAction("pause")}>
                Pause
              </Button>
            ) : agent.rawStatus === "PAUSED" ? (
              <Button variant="outline" size="sm" onClick={() => agentAction("activate")}>
                Activate
              </Button>
            ) : null}
            {agent.rawStatus !== "ARCHIVED" ? (
              <Button variant="outline" size="sm" onClick={() => agentAction("archive")}>
                Archive
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => agentAction("duplicate")}>
              Duplicate
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <Card className="space-y-2 border-emerald-800/20 bg-emerald-50/40 p-4 dark:bg-emerald-950/20">
          <p className="text-sm font-medium">Flow</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Instructions + knowledge (PDF/RAG) + pick a voice (Play a clip) — Save draft.</li>
            <li>
              <strong>Build &amp; test</strong>, then <strong>Test Voice Agent</strong> — real
              WebRTC mic conversation with the same Telnyx assistant as phone.
            </li>
            <li>
              Assign a number under Identity → <strong>Deploy to number</strong> when it sounds right.
            </li>
          </ol>
        </Card>

        <AgentBrowserCall
          agentId={agentId}
          telnyxAssistantId={agent.telnyxAssistantId}
          voiceLabel={voiceLabel(cfg.voiceLanguage?.voiceId || "")}
          status={agent.rawStatus}
          unsavedChanges={dirty}
          onNeedBuild={() => void buildForTest()}
          onSaveDraft={async () => {
            await saveDraft();
          }}
        />

        {section === "tests" && (
          <details className="rounded-lg border border-dashed border-border p-3">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Optional: text debug chat (not a voice test)
            </summary>
            <p className="mb-3 mt-2 text-xs text-muted-foreground">
              Typed chat does not prove microphone, turn-taking, interruptions, or the
              selected voice. Use <strong>Test Voice Agent</strong> above for the real
              browser call.
            </p>
            <AgentTestPanel
              agentId={agentId}
              telnyxAssistantId={agent.telnyxAssistantId}
              voiceId={cfg.voiceLanguage?.voiceId}
              language={cfg.voiceLanguage?.primaryLanguage}
              status={agent.rawStatus}
            />
          </details>
        )}

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
              <Label>AI greeting</Label>
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
              <p className="mt-1 text-[11px] text-muted-foreground">
                Spoken by the AI after the media path is ready (and after any startup mask).
              </p>
            </div>
            <StartupGreetingEditor
              value={
                (cfg.callHandling?.startupGreeting || {}) as Record<string, unknown>
              }
              onChange={(startupGreeting) =>
                updateConfig({
                  callHandling: { ...cfg.callHandling, startupGreeting },
                })
              }
            />
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

        {section === "flow" && (
          <div className="space-y-3">
            <Card className="space-y-2 p-5">
              <CardTitle>Visual call flow</CardTitle>
              <p className="text-sm text-muted-foreground">
                Build Call Routing (who answers) and AI Conversation (what the agent does) as
                separate layers. Save &amp; compile syncs tools, instructions, and routing rules.
                Publish / Build for test deploys the compiled flow to Telnyx.
              </p>
            </Card>
            <VoiceFlowBuilder
              agentId={agentId}
              agentType={agent?.agentType}
              initialBundle={cfg.flows}
              onSaved={(bundle) =>
                updateConfig({
                  flows: bundle,
                })
              }
            />
          </div>
        )}

        {section === "conversationFlow" && (
          <Card className="space-y-3 p-5">
            <CardTitle>Compiled flow sections</CardTitle>
            <p className="text-xs text-muted-foreground">
              These reflect the visual conversation flow after compile. Prefer editing Visual Flow.
            </p>
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
            <VoicePicker
              value={cfg.voiceLanguage?.voiceId}
              language={cfg.voiceLanguage?.primaryLanguage}
              speed={cfg.voiceLanguage?.speed}
              agentId={agentId}
              expressiveMode={cfg.voiceLanguage?.expressiveMode}
              onChange={(voiceId) => {
                updateConfig({
                  voiceLanguage: {
                    ...cfg.voiceLanguage,
                    voiceId,
                    // Ultra defaults expressive on when not yet chosen.
                    ...(isUltraVoice(voiceId) && cfg.voiceLanguage?.expressiveMode == null
                      ? { expressiveMode: true }
                      : {}),
                  },
                });
              }}
            />
            <p className="text-xs text-muted-foreground">
              After changing voice, save (or start Test Voice Agent) so Telnyx syncs the voice
              before you talk. Unsaved edits are not on the live assistant.
            </p>
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
                <p className="mt-1 text-[11px] text-muted-foreground">
                  0.5–2.0 · preview uses the same speed
                </p>
              </div>
              <div>
                <Label>Silence timeout (ms)</Label>
                <Input
                  type="number"
                  min="1000"
                  step="500"
                  value={cfg.voiceLanguage?.silenceTimeoutMs ?? 2500}
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
              <div>
                <Label>Endpointing (ms)</Label>
                <Input
                  type="number"
                  min="100"
                  step="50"
                  value={cfg.voiceLanguage?.endpointingMs ?? 300}
                  onChange={(e) =>
                    updateConfig({
                      voiceLanguage: {
                        ...cfg.voiceLanguage,
                        endpointingMs: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label>End of turn</Label>
                <Input
                  value={cfg.voiceLanguage?.endOfTurn || ""}
                  onChange={(e) =>
                    updateConfig({
                      voiceLanguage: {
                        ...cfg.voiceLanguage,
                        endOfTurn: e.target.value,
                      },
                    })
                  }
                  placeholder="e.g. normal, patient"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.voiceLanguage?.bargeIn ?? true}
                onChange={(e) =>
                  updateConfig({
                    voiceLanguage: {
                      ...cfg.voiceLanguage,
                      bargeIn: e.target.checked,
                    },
                  })
                }
              />
              Allow barge-in (caller can interrupt)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.voiceLanguage?.noiseSuppression ?? true}
                onChange={(e) =>
                  updateConfig({
                    voiceLanguage: {
                      ...cfg.voiceLanguage,
                      noiseSuppression: e.target.checked,
                    },
                  })
                }
              />
              Noise suppression (assistant telephony)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  cfg.voiceLanguage?.expressiveMode ??
                  isUltraVoice(cfg.voiceLanguage?.voiceId)
                }
                onChange={(e) =>
                  updateConfig({
                    voiceLanguage: {
                      ...cfg.voiceLanguage,
                      expressiveMode: e.target.checked,
                    },
                  })
                }
              />
              Expressive delivery (Ultra voices only — Telnyx rejects this on NaturalHD)
            </label>
            <div>
              <Label>Assistant output gain (PSTN A/B)</Label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={String(cfg.voiceLanguage?.outputGainDb ?? -5)}
                onChange={(e) =>
                  updateConfig({
                    voiceLanguage: {
                      ...cfg.voiceLanguage,
                      outputGainDb: Number(e.target.value) as
                        | 0
                        | -3
                        | -4
                        | -5
                        | -6,
                    },
                  })
                }
              >
                <option value="0">0 dB (loudest)</option>
                <option value="-3">−3 dB</option>
                <option value="-4">−4 dB</option>
                <option value="-5">−5 dB (recommended)</option>
                <option value="-6">−6 dB</option>
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Lowers only AI playback for phone clipping — not the caller mic.
                Tune by ear around −4 to −5 dB; going quieter than −6 usually just
                sounds quiet.
              </p>
            </div>
            <div className="rounded border border-border p-3 text-xs">
              <p className="font-medium">PSTN interference checklist</p>
              <p className="mt-1 text-muted-foreground">
                Same sentence + voice. Save Telnyx call ID from Observability for
                each run.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                <li>Browser WebRTC (control — should be clean)</li>
                <li>Cell on your carrier @ −4 / −5 / −6 dB</li>
                <li>Cell on a second carrier @ −5 dB</li>
                <li>Second premium NaturalHD voice @ −5 dB</li>
              </ul>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Production default: NaturalHD (Standard Voice). Ultra Voice uses
              Telnyx.Ultra.&lt;id&gt; with optional expressive mode — use Test Voice
              on a clone before applying to the live receptionist.
            </p>
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
          <Card className="space-y-5 p-5">
            <div>
              <CardTitle>Tools</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Enable only the tools this agent needs. Catalog tools appear for every
                agent; nothing is attached to Telnyx until you enable it and publish.
              </p>
            </div>

            {catalogGroups.map((group) => (
              <div key={group.category} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.tools.map((tool: CatalogToolDef) => {
                    const on = enabledBuiltinTools.includes(tool.key);
                    return (
                      <label
                        key={tool.key}
                        className={cn(
                          "flex cursor-pointer flex-col gap-1 rounded-md border px-3 py-2.5 text-sm transition-colors",
                          on
                            ? "border-foreground/25 bg-muted/40"
                            : "border-border bg-background",
                          tool.comingSoon && "opacity-60",
                        )}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-2 font-medium">
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={tool.comingSoon}
                              onChange={() => toggleBuiltinTool(tool.key)}
                            />
                            {tool.name}
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {tool.access}
                            {tool.risk !== "low" ? ` · ${tool.risk}` : ""}
                          </span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">
                          {tool.description}
                        </span>
                        {tool.requiresIntegration ? (
                          <span className="pl-6 text-[11px] text-muted-foreground">
                            Uses: {tool.requiresIntegration}
                            {tool.comingSoon ? " · Coming soon" : ""}
                          </span>
                        ) : null}
                        {tool.disclosureSensitive ? (
                          <span className="pl-6 text-[11px] text-amber-700 dark:text-amber-400">
                            Phone disclosure limited to browser / internal test mode
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Custom workspace tools
              </h3>
              {toolOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No custom webhook tools yet. Create them under Voice → Tools.
                </p>
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
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={linkSaving}
                onClick={() =>
                  setEnabledBuiltinTools(
                    defaultBuiltinToolsForAgentType(agent?.agentType),
                  )
                }
              >
                Reset to template defaults
              </Button>
              <Button disabled={linkSaving} onClick={saveTools}>
                {linkSaving ? "Saving…" : "Save tool assignments"}
              </Button>
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
            <div>
              <Label>Max tokens</Label>
              <Input
                type="number"
                min="64"
                step="64"
                value={cfg.model?.maxTokens ?? ""}
                onChange={(e) =>
                  updateConfig({
                    model: {
                      ...cfg.model,
                      maxTokens: e.target.value ? Number(e.target.value) : undefined,
                    },
                  })
                }
              />
            </div>
            <div>
              <Label>Custom LLM base URL (optional)</Label>
              <Input
                value={cfg.model?.customBaseUrl || ""}
                onChange={(e) =>
                  updateConfig({
                    model: { ...cfg.model, customBaseUrl: e.target.value || undefined },
                  })
                }
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div>
              <Label>Custom API key ref (server secret name)</Label>
              <Input
                value={cfg.model?.customApiKeyRef || ""}
                onChange={(e) =>
                  updateConfig({
                    model: { ...cfg.model, customApiKeyRef: e.target.value || undefined },
                  })
                }
                placeholder="CUSTOM_LLM_API_KEY"
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

        {(section === "transcription" ||
          section === "messaging" ||
          section === "memory" ||
          section === "mcp" ||
          section === "insights" ||
          section === "tests" ||
          section === "versions" ||
          section === "canary" ||
          section === "scheduled" ||
          section === "observability" ||
          section === "security") && (
          <Card className="space-y-3 p-5">
            <CardTitle>{SECTIONS.find((s) => s.id === section)?.label}</CardTitle>
            {section === "transcription" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>STT provider</Label>
                  <Input
                    value={cfg.transcription?.sttProvider || ""}
                    onChange={(e) =>
                      updateConfig({
                        transcription: { ...cfg.transcription, sttProvider: e.target.value },
                      })
                    }
                    placeholder="telnyx / deepgram / …"
                  />
                </div>
                <div>
                  <Label>STT model</Label>
                  <Input
                    value={cfg.transcription?.sttModel || ""}
                    onChange={(e) =>
                      updateConfig({
                        transcription: { ...cfg.transcription, sttModel: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Keyterms (comma-separated)</Label>
                  <Input
                    value={(cfg.transcription?.keyterms || []).join(", ")}
                    onChange={(e) =>
                      updateConfig({
                        transcription: {
                          ...cfg.transcription,
                          keyterms: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
            {section === "messaging" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  SMS follow-ups use messaging-ready numbers. Preview Telnyx SMS chat below.
                </p>
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() =>
                    platformAct("sms_chat_preview", {
                      message: "Hi — confirming this SMS assistant channel works.",
                    })
                  }
                >
                  SMS chat preview
                </Button>
              </div>
            )}
            {section === "memory" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("save_memory", { mode: "caller", retentionDays: 30 })}
                >
                  Save caller memory
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("preview_memory")}
                >
                  Preview memory
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("clear_memory")}
                >
                  Clear memory
                </Button>
              </div>
            )}
            {section === "mcp" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("ensure_transovo_mcp")}
                >
                  Attach Transovo MCP
                </Button>
              </div>
            )}
            {section === "insights" && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!!platformBusy} onClick={() => platformAct("seed_insights")}>
                  Seed default insights
                </Button>
                <Button size="sm" disabled={!!platformBusy} onClick={() => platformAct("sync_insights")}>
                  Sync insights
                </Button>
              </div>
            )}
            {section === "tests" && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!!platformBusy} onClick={() => platformAct("seed_suite")}>
                  Seed suite
                </Button>
                <Button size="sm" disabled={!!platformBusy} onClick={() => platformAct("run_suite")}>
                  Run suite
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("schedule_regression")}
                >
                  Schedule daily regression
                </Button>
              </div>
            )}
            {section === "versions" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!!platformBusy}
                    onClick={() => platformAct("sync_versions")}
                  >
                    Sync versions
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!platformBusy || !compareLeft || !compareRight}
                    onClick={() =>
                      platformAct("compare_versions", {
                        leftVersionId: compareLeft,
                        rightVersionId: compareRight,
                      })
                    }
                  >
                    Compare
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Left version</Label>
                    <select
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                      value={compareLeft}
                      onChange={(e) => setCompareLeft(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {remoteVersions.map((v) => (
                        <option key={v.telnyxVersionId} value={v.telnyxVersionId}>
                          {v.label || v.name || v.telnyxVersionId}
                          {v.isMain ? " (main)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Right version</Label>
                    <select
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                      value={compareRight}
                      onChange={(e) => setCompareRight(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {remoteVersions.map((v) => (
                        <option key={`r-${v.telnyxVersionId}`} value={v.telnyxVersionId}>
                          {v.label || v.name || v.telnyxVersionId}
                          {v.isMain ? " (main)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {compareResult ? (
                  <div className="rounded border border-border bg-muted/20 p-3 text-xs">
                    <p className="font-medium">{compareResult.diffCount ?? 0} differing keys</p>
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                      {(compareResult.diffs || []).slice(0, 40).map((d) => (
                        <li key={d.key} className="font-mono">
                          {d.key}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
            {section === "canary" && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Canary %</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={canaryPct}
                      onChange={(e) => setCanaryPct(Number(e.target.value) || 10)}
                    />
                  </div>
                  <div>
                    <Label>Canary version</Label>
                    <select
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                      value={canaryVersionId}
                      onChange={(e) => setCanaryVersionId(e.target.value)}
                    >
                      <option value="main">main</option>
                      {remoteVersions.map((v) => (
                        <option key={`c-${v.telnyxVersionId}`} value={v.telnyxVersionId}>
                          {v.label || v.name || v.telnyxVersionId}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!!platformBusy}
                    onClick={() =>
                      platformAct("upsert_canary", {
                        rules: [{ percentage: canaryPct, version_id: canaryVersionId || "main" }],
                      })
                    }
                  >
                    Start canary {canaryPct}%
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!platformBusy}
                    onClick={() => platformAct("canary_metrics")}
                  >
                    Canary metrics
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!platformBusy}
                    onClick={() => platformAct("delete_canary")}
                  >
                    Rollback canary
                  </Button>
                </div>
              </div>
            )}
            {section === "scheduled" && (
              <p className="text-sm text-muted-foreground">
                Schedule SMS from AI platform. Outbound AI phone schedules stay gated
                (`outboundAiEnabled` + consent).
              </p>
            )}
            {section === "observability" && (
              <Button
                size="sm"
                disabled={!!platformBusy}
                onClick={() =>
                  platformAct("save_observability", {
                    langfuseEnabled: false,
                    enabledFeatures: ["transcription"],
                  })
                }
              >
                Save observability
              </Button>
            )}
            {section === "security" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("set_flags", { emergencyDisabled: true })}
                >
                  Emergency stop
                </Button>
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("set_flags", { emergencyDisabled: false })}
                >
                  Clear emergency
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("run_retention")}
                >
                  Run retention purge
                </Button>
              </div>
            )}
            {platformMsg ? <p className="text-xs text-amber-800">{platformMsg}</p> : null}
          </Card>
        )}

        {section === "platform" && (
          <div className="space-y-4">
            <Card className="space-y-3 p-5">
              <CardTitle>AI Platform controls</CardTitle>
              <p className="text-sm text-muted-foreground">
                Versions, canary, memory, MCP, transfers, tests, and safety flags for this Telnyx
                assistant. Full ops console:{" "}
                <a className="underline" href="/voice/ai-platform">
                  /voice/ai-platform
                </a>
              </p>
              {platformMsg ? (
                <p className="text-xs text-amber-800">{platformMsg}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("sync_versions")}
                >
                  Sync versions
                </Button>
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() =>
                    platformAct("upsert_canary", {
                      rules: [{ percentage: canaryPct, version_id: canaryVersionId || "main" }],
                    })
                  }
                >
                  Canary {canaryPct}%
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("delete_canary")}
                >
                  Delete canary
                </Button>
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("seed_suite")}
                >
                  Seed test suite
                </Button>
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("run_suite")}
                >
                  Run suite
                </Button>
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() => platformAct("enrich_remote")}
                >
                  Re-enrich remote
                </Button>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <Label>Canary %</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={canaryPct}
                    onChange={(e) => setCanaryPct(Number(e.target.value) || 10)}
                  />
                </div>
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <CardTitle>Safety &amp; channel flags</CardTitle>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Emergency: {platformFlags.emergencyDisabled ? "STOPPED" : "clear"}</li>
                <li>Multi-party AI: {platformFlags.multiPartyEnabled ? "on" : "off"}</li>
                <li>Outbound AI campaigns: {platformFlags.outboundAiEnabled ? "on" : "off"}</li>
                <li>Widget: {platformFlags.widgetEnabled ? "on" : "off"}</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!platformBusy}
                  onClick={() =>
                    platformAct("set_flags", { emergencyDisabled: true })
                  }
                >
                  Emergency stop
                </Button>
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() =>
                    platformAct("set_flags", { emergencyDisabled: false })
                  }
                >
                  Clear emergency
                </Button>
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() =>
                    platformAct("set_flags", {
                      multiPartyEnabled: !platformFlags.multiPartyEnabled,
                    })
                  }
                >
                  Toggle multi-party
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!platformBusy}
                  onClick={() =>
                    platformAct("set_flags", {
                      outboundAiEnabled: !platformFlags.outboundAiEnabled,
                    })
                  }
                >
                  Toggle outbound AI
                </Button>
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <CardTitle>Memory</CardTitle>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label>Mode</Label>
                  <select
                    className="block rounded border border-border bg-background px-2 py-1 text-sm"
                    value={memoryMode}
                    onChange={(e) => setMemoryMode(e.target.value)}
                  >
                    <option value="none">none</option>
                    <option value="conversation">conversation</option>
                    <option value="caller">caller</option>
                  </select>
                </div>
                <Button
                  size="sm"
                  disabled={!!platformBusy}
                  onClick={() =>
                    platformAct("save_memory", {
                      mode: memoryMode,
                      retentionDays: 30,
                    })
                  }
                >
                  Save memory
                </Button>
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <CardTitle>Transfer destination</CardTitle>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input value={destName} onChange={(e) => setDestName(e.target.value)} />
                </div>
                <div>
                  <Label>E.164 destination</Label>
                  <Input value={destNumber} onChange={(e) => setDestNumber(e.target.value)} />
                </div>
              </div>
              <Button
                size="sm"
                disabled={!!platformBusy}
                onClick={() =>
                  platformAct("upsert_destination", {
                    name: destName,
                    kind: "external",
                    destination: destNumber,
                  })
                }
              >
                Save destination
              </Button>
            </Card>

            <Card className="space-y-3 p-5">
              <CardTitle>MCP server (pending review)</CardTitle>
              <p className="text-xs text-muted-foreground">
                New MCP servers stay unapproved until an admin approves them on the AI platform
                page.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input value={mcpName} onChange={(e) => setMcpName(e.target.value)} />
                </div>
                <div>
                  <Label>URL</Label>
                  <Input value={mcpUrl} onChange={(e) => setMcpUrl(e.target.value)} />
                </div>
              </div>
              <Button
                size="sm"
                disabled={!!platformBusy || !mcpName || !mcpUrl}
                onClick={() =>
                  platformAct("register_mcp", {
                    name: mcpName,
                    url: mcpUrl,
                    approved: false,
                  })
                }
              >
                Register MCP
              </Button>
            </Card>

            <Card className="space-y-3 p-5">
              <CardTitle>Web widget</CardTitle>
              <Button
                size="sm"
                disabled={!!platformBusy}
                onClick={() =>
                  platformAct("save_widget", {
                    domainAllowlist: ["transovo.ai", "localhost"],
                    testMode: true,
                    captchaEnabled: true,
                    rateLimitPerMin: 30,
                  })
                }
              >
                Enable widget (test mode)
              </Button>
              <p className="text-xs text-muted-foreground">
                Embed: <code>/embed/voice/{agentId}</code>
              </p>
            </Card>

            <Card className="space-y-3 p-5">
              <CardTitle>Observability</CardTitle>
              <Button
                size="sm"
                disabled={!!platformBusy}
                onClick={() =>
                  platformAct("save_observability", {
                    langfuseEnabled: false,
                    enabledFeatures: ["transcription"],
                  })
                }
              >
                Save observability (transcription)
              </Button>
            </Card>
          </div>
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

/** Pre-AI call mask — hides media setup behind a short professional line. */
function StartupGreetingEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const enabled = value.enabled !== false && value.mode !== "none";
  const mode = String(value.mode || "ai");
  const text = String(
    value.text ||
      "Thank you for calling. Please hold for just a moment while I connect you with our AI assistant.",
  );
  const audioUrl = String(value.audioUrl || "");
  const delayMs = value.delayMs === undefined || value.delayMs === "auto" ? "auto" : String(value.delayMs);
  const handOffWhenReady = value.handOffWhenReady !== false;

  function patch(partial: Record<string, unknown>) {
    onChange({
      enabled,
      mode,
      text,
      audioUrl,
      delayMs: value.delayMs === undefined ? "auto" : value.delayMs,
      handOffWhenReady,
      ...partial,
    });
  }

  return (
    <div className="space-y-3 rounded border border-border p-3">
      <div>
        <p className="text-sm font-medium">Startup greeting</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Recommended: one complete greeting spoken by the AI voice after media
          is ready. Avoid a short “Thank you” mask plus a second AI thank-you.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            patch({
              enabled: e.target.checked,
              mode: e.target.checked ? (mode === "none" ? "ai" : mode) : "none",
            })
          }
        />
        Greeting enabled
      </label>
      {enabled ? (
        <>
          <div>
            <Label>Connection greeting</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={
                String(value.connectionGreeting || "") === "transovo_default" ||
                mode === "transovo_default"
                  ? "transovo_default"
                  : "off"
              }
              onChange={(e) => {
                const v = e.target.value;
                if (v === "transovo_default") {
                  patch({
                    connectionGreeting: "transovo_default",
                    mode: "transovo_default",
                    delayMs: 5000,
                    handOffWhenReady: true,
                  });
                } else {
                  patch({
                    connectionGreeting: "off",
                    mode: mode === "transovo_default" || mode === "audio_url" ? "ai" : mode,
                  });
                }
              }}
            >
              <option value="off">Off</option>
              <option value="transovo_default">Transovo default</option>
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Plays a polished prerecorded greeting with soft music immediately on
              answer while the AI initializes. Does not replace the AI greeting.
            </p>
          </div>
          {String(value.connectionGreeting || "") !== "transovo_default" &&
          mode !== "transovo_default" ? (
          <div>
            <Label>Greeting type (advanced)</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={mode === "transovo_default" ? "ai" : mode}
              onChange={(e) => {
                const v = e.target.value;
                patch({ connectionGreeting: "off", mode: v });
              }}
            >
              <option value="ai">AI voice — one full greeting (recommended)</option>
              <option value="tts">Pre-mask TTS, then AI (advanced)</option>
              <option value="audio_url">Pre-mask audio URL, then AI</option>
              <option value="none">None / Off</option>
            </select>
          </div>
          ) : null}
          {mode === "ai" &&
          String(value.connectionGreeting || "") !== "transovo_default" ? (
            <p className="text-[11px] text-muted-foreground">
              Uses the AI greeting above. We settle media ~700 ms after answer,
              then start the assistant once (no duplicate greetings).
            </p>
          ) : null}
          {String(value.connectionGreeting || "") === "transovo_default" ||
          mode === "transovo_default" ? (
            <p className="text-[11px] text-muted-foreground">
              Prerecorded file plays immediately on answer (~4–5 s). AI greeting
              starts after playback so the two never overlap.
            </p>
          ) : null}
          {mode === "tts" ? (
            <div>
              <Label>Mask text (plays before AI)</Label>
              <Input
                value={text}
                onChange={(e) => patch({ text: e.target.value })}
                placeholder="Thank you for calling. Please hold for just a moment…"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Use 3–5 seconds of natural speech if masking. Keep the AI greeting
                different so callers do not hear “Thank you” twice.
              </p>
            </div>
          ) : null}
          {mode === "audio_url" ? (
            <div>
              <Label>Audio URL</Label>
              <Input
                value={audioUrl}
                onChange={(e) => patch({ audioUrl: e.target.value })}
                placeholder="https://…/greeting.mp3"
              />
            </div>
          ) : null}
          <div>
            <Label>Greeting delay</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={delayMs}
              onChange={(e) =>
                patch({
                  delayMs:
                    e.target.value === "auto" ? "auto" : Number(e.target.value),
                })
              }
            >
              <option value="auto">Auto (recommended)</option>
              <option value="800">0.8 s</option>
              <option value="1200">1.2 s</option>
              <option value="2000">2.0 s</option>
              <option value="3000">3.0 s</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={handOffWhenReady}
              onChange={(e) => patch({ handOffWhenReady: e.target.checked })}
            />
            Hand off when AI ready (wait for mask, then start assistant)
          </label>
        </>
      ) : null}
    </div>
  );
}
