"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";

type Queue = {
  id: string;
  name: string;
  strategy: string;
  timeoutSeconds: number;
  memberUserIds: string[];
  overflowAction: string;
  overflowTarget: string | null;
  active: boolean;
  phoneNumberIds: string[];
};

type Member = { id: string; name: string; email: string };
type PhoneNum = { id: string; e164: string; friendlyName?: string | null };

const STRATEGIES = [
  { value: "ring_all", label: "Ring all members" },
  { value: "round_robin", label: "Round robin" },
  { value: "longest_idle", label: "Longest idle" },
  { value: "linear", label: "Linear (in order)" },
];

const OVERFLOWS = [
  { value: "voicemail", label: "Send to voicemail" },
  { value: "forward", label: "Forward to number" },
  { value: "hangup", label: "Hang up" },
  { value: "ai_agent", label: "Hand off to AI agent" },
  { value: "callback", label: "Offer callback" },
];

const emptyForm = {
  name: "",
  strategy: "ring_all",
  timeoutSeconds: 30,
  memberUserIds: [] as string[],
  overflowAction: "voicemail",
  overflowTarget: "",
  active: true,
  phoneNumberIds: [] as string[],
};

export default function PhoneQueuesPage() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [numbers, setNumbers] = useState<PhoneNum[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/phone/queues").then((r) => r.json()).then((j) => setQueues(j.data || []));
  }

  useEffect(() => {
    load();
    fetch("/api/team")
      .then((r) => r.json())
      .then((j) => setMembers(j.data || []))
      .catch(() => undefined);
    fetch("/api/phone/numbers")
      .then((r) => r.json())
      .then((j) => setNumbers(j.data || []))
      .catch(() => undefined);
  }, []);

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setError("");
  }

  function startEdit(q: Queue) {
    setEditingId(q.id);
    setForm({
      name: q.name,
      strategy: q.strategy,
      timeoutSeconds: q.timeoutSeconds,
      memberUserIds: q.memberUserIds || [],
      overflowAction: q.overflowAction,
      overflowTarget: q.overflowTarget || "",
      active: q.active,
      phoneNumberIds: q.phoneNumberIds || [],
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `/api/phone/queues/${editingId}` : "/api/phone/queues";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, overflowTarget: form.overflowTarget || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      resetForm();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this queue?")) return;
    await fetch(`/api/phone/queues/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    load();
  }

  function toggleMember(id: string) {
    setForm((f) => ({
      ...f,
      memberUserIds: f.memberUserIds.includes(id)
        ? f.memberUserIds.filter((m) => m !== id)
        : [...f.memberUserIds, id],
    }));
  }

  function toggleNumber(id: string) {
    setForm((f) => ({
      ...f,
      phoneNumberIds: f.phoneNumberIds.includes(id)
        ? f.phoneNumberIds.filter((n) => n !== id)
        : [...f.phoneNumberIds, id],
    }));
  }

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name || members.find((m) => m.id === id)?.email || id;

  return (
    <div>
      <PageHeader
        title="Call queues"
        description="Route inbound calls to a team of agents with a ring strategy and overflow fallback."
      />
      <PhoneSubNav />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="space-y-4">
          <CardTitle>{editingId ? "Edit queue" : "New queue"}</CardTitle>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Support" />
          </div>
          <div>
            <Label>Ring strategy</Label>
            <Select value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })}>
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Ring timeout (seconds)</Label>
            <Input
              type="number"
              value={form.timeoutSeconds}
              onChange={(e) => setForm({ ...form, timeoutSeconds: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Members</Label>
            <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-border p-2">
              {members.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">No team members found.</p>
              ) : (
                members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={form.memberUserIds.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                    />
                    <span>{m.name || m.email}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <Label>Overflow (when nobody answers)</Label>
            <Select value={form.overflowAction} onChange={(e) => setForm({ ...form, overflowAction: e.target.value })}>
              {OVERFLOWS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          {(form.overflowAction === "forward" || form.overflowAction === "ai_agent") && (
            <div>
              <Label>
                {form.overflowAction === "ai_agent" ? "AI agent id" : "Forward to number"}
              </Label>
              <Input
                value={form.overflowTarget}
                onChange={(e) => setForm({ ...form, overflowTarget: e.target.value })}
                placeholder={form.overflowAction === "ai_agent" ? "agent id" : "+1..."}
              />
            </div>
          )}
          <div>
            <Label>Assigned phone numbers</Label>
            <div className="max-h-32 space-y-1 overflow-auto rounded-lg border border-border p-2">
              {numbers.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">No phone numbers.</p>
              ) : (
                numbers.map((n) => (
                  <label key={n.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={form.phoneNumberIds.includes(n.id)}
                      onChange={() => toggleNumber(n.id)}
                    />
                    <span className="font-mono text-xs">{n.e164}</span>
                    {n.friendlyName ? <span className="text-muted-foreground">· {n.friendlyName}</span> : null}
                  </label>
                ))
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !form.name.trim()} className="gap-1">
              <Plus className="h-4 w-4" /> {editingId ? "Save changes" : "Create queue"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            )}
          </div>
        </Card>

        <div className="space-y-3">
          {queues.length === 0 ? (
            <Card><p className="text-sm text-muted-foreground">No queues yet. Create one to route inbound calls to a team.</p></Card>
          ) : (
            queues.map((q) => (
              <Card key={q.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-sm font-semibold">{q.name}</h3>
                      <StatusChip status={q.active ? "Active" : "Paused"} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {STRATEGIES.find((s) => s.value === q.strategy)?.label || q.strategy} · ring {q.timeoutSeconds}s ·
                      overflow {q.overflowAction}{q.overflowTarget ? ` → ${q.overflowTarget}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => startEdit(q)}>Edit</Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(q.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(q.memberUserIds || []).map((m) => (
                    <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs">{memberName(m)}</span>
                  ))}
                  {(q.memberUserIds || []).length === 0 && (
                    <span className="text-xs text-muted-foreground">No members assigned</span>
                  )}
                </div>
                {(q.phoneNumberIds || []).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Numbers: {q.phoneNumberIds.map((id) => numbers.find((n) => n.id === id)?.e164 || id).join(", ")}
                  </p>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
