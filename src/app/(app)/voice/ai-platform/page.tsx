"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { useEffect, useState } from "react";

type Diagnostics = {
  telnyxConfigured: boolean;
  registry: {
    total: number;
    counts: Record<string, number>;
    items: Array<{
      id: string;
      label: string;
      phase: number;
      status: string;
      telnyxPaths: string[];
      notes?: string;
    }>;
  };
  counts: Record<string, number>;
  concurrency: Record<string, number | null>;
};

type AgentRow = {
  id: string;
  name: string;
  telnyxAssistantId?: string;
  emergencyDisabled?: boolean;
  multiPartyEnabled?: boolean;
  outboundAiEnabled?: boolean;
  widgetEnabled?: boolean;
};

export default function VoiceAiPlatformPage() {
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [agentId, setAgentId] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [chatIn, setChatIn] = useState("Hello, what are your hours?");
  const [chatOut, setChatOut] = useState("");
  const [versions, setVersions] = useState<Array<{ id: string; telnyxVersionId: string; label?: string | null; isMain: boolean }>>([]);
  const [mcp, setMcp] = useState<Array<{ id: string; name: string; url: string; approved: boolean; status: string }>>([]);
  const [destinations, setDestinations] = useState<Array<{ id: string; name: string; destination: string }>>([]);
  const [conversations, setConversations] = useState<Array<{ id: string; telnyxConversationId: string; status: string }>>([]);
  const [insightGroups, setInsightGroups] = useState<Array<{ id: string; name: string; telnyxGroupId?: string | null }>>([]);
  const [failures, setFailures] = useState<Array<{ id: string; category: string; code?: string | null; message: string }>>([]);
  const [maxInbound, setMaxInbound] = useState(5);
  const [maxOutbound, setMaxOutbound] = useState(0);
  const [schedTarget, setSchedTarget] = useState("");
  const [schedText, setSchedText] = useState("Reminder from Transovo");
  const [schedAt, setSchedAt] = useState("");

  async function load() {
    const [dRes, aRes] = await Promise.all([
      fetch("/api/voice/ai?view=diagnostics"),
      fetch("/api/voice/agents"),
    ]);
    if (dRes.ok) {
      const j = await dRes.json();
      setDiag(j.data);
      if (j.data?.concurrency) {
        setMaxInbound(Number(j.data.concurrency.maxInboundAi ?? 5));
        setMaxOutbound(Number(j.data.concurrency.maxOutboundAi ?? 0));
      }
    }
    if (aRes.ok) {
      const j = await aRes.json();
      const rows = j.data || [];
      setAgents(rows);
      if (!agentId && rows[0]?.id) setAgentId(rows[0].id);
    }
  }

  async function loadAgentViews(id: string) {
    if (!id) return;
    const [v, m, d, c, i, f] = await Promise.all([
      fetch(`/api/voice/ai?view=versions&agentId=${id}`),
      fetch("/api/voice/ai?view=mcp"),
      fetch(`/api/voice/ai?view=destinations&agentId=${id}`),
      fetch("/api/voice/ai?view=conversations"),
      fetch("/api/voice/ai?view=insights"),
      fetch("/api/voice/ai?view=diagnostics_failures"),
    ]);
    if (v.ok) setVersions((await v.json()).data || []);
    if (m.ok) setMcp((await m.json()).data || []);
    if (d.ok) setDestinations((await d.json()).data || []);
    if (c.ok) setConversations((await c.json()).data || []);
    if (i.ok) {
      const j = await i.json();
      setInsightGroups(j.data?.groups || []);
    }
    if (f.ok) setFailures((await f.json()).data || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (agentId) loadAgentViews(agentId).catch(() => undefined);
  }, [agentId]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMsg("");
    try {
      const res = await fetch("/api/voice/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, agentId, ...extra }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `Failed ${action}`);
      setMsg(`${action}: ok`);
      if (action === "chat_preview") {
        setChatOut(JSON.stringify(j.data, null, 2));
      }
      await load();
      await loadAgentViews(agentId);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Voice platform"
        description="Telnyx AI Assistants — versions, canary, tests, memory, MCP, conversations, concurrency. Outbound AI campaigns stay disabled unless explicitly enabled per agent."
      />
      <VoiceSubNav />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Diagnostics</CardTitle>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Telnyx AI configured: {diag?.telnyxConfigured ? "yes" : "no"}</li>
            <li>
              Registry: {diag?.registry.total ?? 0} capabilities ·{" "}
              {Object.entries(diag?.registry.counts || {})
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")}
            </li>
            <li>
              Local counts:{" "}
              {Object.entries(diag?.counts || {})
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ") || "—"}
            </li>
            <li>
              Concurrency: inbound {diag?.concurrency?.maxInboundAi ?? "—"} · outbound AI{" "}
              {diag?.concurrency?.maxOutboundAi ?? 0} · transfers{" "}
              {diag?.concurrency?.maxTransferLegs ?? "—"}
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded border border-border bg-background px-2 py-1 text-sm"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">Select agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.telnyxAssistantId ? "" : " (unpublished)"}
                </option>
              ))}
            </select>
            <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => load()}>
              Refresh
            </Button>
          </div>
          {msg ? <p className="text-xs text-amber-800">{msg}</p> : null}
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Lifecycle controls</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!agentId || !!busy} onClick={() => act("sync_versions")}>
              Sync versions
            </Button>
            <Button
              size="sm"
              disabled={!agentId || !!busy}
              onClick={() =>
                act("upsert_canary", {
                  rules: [{ percentage: 10, version_id: "main" }],
                })
              }
            >
              Canary 10%
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!agentId || !!busy}
              onClick={() => act("delete_canary")}
            >
              Delete canary
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => act("sync_tests")}>
              Sync tests
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => act("seed_suite")}>
              Seed suite
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => act("run_suite")}>
              Run default suite
            </Button>
            <Button
              size="sm"
              disabled={!agentId || !!busy}
              onClick={() => act("save_memory", { mode: "caller", retentionDays: 30 })}
            >
              Memory: caller
            </Button>
            <Button
              size="sm"
              disabled={!agentId || !!busy}
              onClick={() => act("sync_conversations")}
            >
              Sync conversations
            </Button>
            <Button
              size="sm"
              disabled={!agentId || !!busy}
              onClick={() => act("sync_insights")}
            >
              Sync insights
            </Button>
            <Button
              size="sm"
              disabled={!agentId || !!busy}
              onClick={() =>
                act("save_widget", {
                  domainAllowlist: ["transovo.ai"],
                  testMode: true,
                })
              }
            >
              Enable widget (test)
            </Button>
            <Button
              size="sm"
              disabled={!agentId || !!busy}
              onClick={() => act("enrich_remote")}
            >
              Enrich remote
            </Button>
            <Button
              size="sm"
              disabled={!agentId || !!busy}
              onClick={() => act("clone_agent")}
            >
              Clone agent
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!agentId || !!busy}
              onClick={() => act("set_flags", { emergencyDisabled: true })}
            >
              Emergency stop
            </Button>
            <Button
              size="sm"
              disabled={!agentId || !!busy}
              onClick={() => act("set_flags", { emergencyDisabled: false })}
            >
              Clear emergency
            </Button>
            <Button
              size="sm"
              disabled={!agentId || !!busy}
              onClick={() => act("set_flags", { multiPartyEnabled: true })}
            >
              Enable multi-party
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Remote versions</CardTitle>
          <ul className="max-h-48 space-y-1 overflow-auto text-sm">
            {versions.length === 0 ? (
              <li className="text-muted-foreground">Sync versions to populate</li>
            ) : (
              versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span>
                    {v.label || v.telnyxVersionId}
                    {v.isMain ? " (main)" : ""}
                  </span>
                  {!v.isMain ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() =>
                        act("promote_version", { telnyxVersionId: v.telnyxVersionId })
                      }
                    >
                      Promote
                    </Button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Concurrency</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              Max inbound AI
              <input
                type="number"
                className="mt-1 block w-24 rounded border border-border bg-background px-2 py-1 text-sm"
                value={maxInbound}
                onChange={(e) => setMaxInbound(Number(e.target.value) || 0)}
              />
            </label>
            <label className="text-xs">
              Max outbound AI
              <input
                type="number"
                className="mt-1 block w-24 rounded border border-border bg-background px-2 py-1 text-sm"
                value={maxOutbound}
                onChange={(e) => setMaxOutbound(Number(e.target.value) || 0)}
              />
            </label>
            <Button
              size="sm"
              disabled={!!busy}
              onClick={() =>
                act("upsert_concurrency", {
                  maxInboundAi: maxInbound,
                  maxOutboundAi: maxOutbound,
                })
              }
            >
              Save concurrency
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">MCP servers</CardTitle>
          <ul className="max-h-48 space-y-2 overflow-auto text-sm">
            {mcp.length === 0 ? (
              <li className="text-muted-foreground">No MCP servers registered</li>
            ) : (
              mcp.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {row.name} · {row.approved ? "approved" : row.status}
                  </span>
                  <span className="flex gap-1">
                    {!row.approved ? (
                      <Button
                        size="sm"
                        disabled={!!busy}
                        onClick={() => act("approve_mcp", { mcpId: row.id })}
                      >
                        Approve
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => act("reject_mcp", { mcpId: row.id })}
                    >
                      Reject
                    </Button>
                  </span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Transfer destinations</CardTitle>
          <ul className="max-h-40 space-y-1 overflow-auto text-sm">
            {destinations.length === 0 ? (
              <li className="text-muted-foreground">None — add from agent builder AI Platform</li>
            ) : (
              destinations.map((d) => (
                <li key={d.id}>
                  {d.name}: <span className="font-mono">{d.destination}</span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Insight groups</CardTitle>
          <ul className="max-h-40 space-y-1 overflow-auto text-sm">
            {insightGroups.length === 0 ? (
              <li className="text-muted-foreground">Sync insights or create a group</li>
            ) : (
              insightGroups.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2">
                  <span>{g.name}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!agentId || !!busy}
                    onClick={() => act("attach_insight_group", { insightGroupId: g.id })}
                  >
                    Attach
                  </Button>
                </li>
              ))
            )}
          </ul>
          <Button
            size="sm"
            disabled={!!busy}
            onClick={() =>
              act("create_insight_group", {
                name: "transovo-default-insights",
                webhook_url:
                  typeof window !== "undefined"
                    ? `${window.location.origin}/api/telnyx/voice/insights`
                    : undefined,
              })
            }
          >
            Create default insight group
          </Button>
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Scheduled SMS (gated phone)</CardTitle>
          <input
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            placeholder="End user E.164"
            value={schedTarget}
            onChange={(e) => setSchedTarget(e.target.value)}
          />
          <input
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
            placeholder="ISO schedule time"
            value={schedAt}
            onChange={(e) => setSchedAt(e.target.value)}
          />
          <textarea
            className="w-full rounded border border-border bg-background p-2 text-sm"
            rows={2}
            value={schedText}
            onChange={(e) => setSchedText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!agentId || !!busy || !schedTarget || !schedAt}
              onClick={() =>
                act("schedule_event", {
                  channel: "sms_chat",
                  endUserTarget: schedTarget,
                  agentTarget: agents.find((a) => a.id === agentId)?.telnyxAssistantId || "",
                  scheduledAt: schedAt,
                  text: schedText,
                })
              }
            >
              Schedule SMS
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!agentId || !!busy}
              onClick={() => act("sync_scheduled")}
            >
              Sync scheduled
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Conversations</CardTitle>
          <ul className="max-h-40 space-y-1 overflow-auto text-xs font-mono">
            {conversations.slice(0, 20).map((c) => (
              <li key={c.id}>
                {c.telnyxConversationId} · {c.status}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Recent failure diagnostics</CardTitle>
          <ul className="max-h-40 space-y-1 overflow-auto text-xs">
            {failures.length === 0 ? (
              <li className="text-muted-foreground">None recorded</li>
            ) : (
              failures.slice(0, 15).map((f) => (
                <li key={f.id}>
                  [{f.category}/{f.code || "—"}] {f.message}
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="space-y-3 p-4 lg:col-span-2">
          <CardTitle className="text-base">Test console (Telnyx chat)</CardTitle>
          <textarea
            className="w-full rounded border border-border bg-background p-2 text-sm"
            rows={2}
            value={chatIn}
            onChange={(e) => setChatIn(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!agentId || !!busy}
            onClick={() => act("chat_preview", { message: chatIn })}
          >
            Send chat preview
          </Button>
          {chatOut ? (
            <pre className="max-h-64 overflow-auto rounded bg-muted/40 p-2 text-xs">{chatOut}</pre>
          ) : null}
        </Card>

        <Card className="space-y-3 p-4 lg:col-span-2">
          <CardTitle className="text-base">Capability registry</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1 pr-2">Phase</th>
                  <th className="py-1 pr-2">Capability</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Telnyx paths</th>
                </tr>
              </thead>
              <tbody>
                {(diag?.registry.items || []).map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-1 pr-2">{c.phase}</td>
                    <td className="py-1 pr-2">{c.label}</td>
                    <td className="py-1 pr-2">{c.status}</td>
                    <td className="py-1 pr-2 font-mono">
                      {(c.telnyxPaths || []).join(", ")}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
