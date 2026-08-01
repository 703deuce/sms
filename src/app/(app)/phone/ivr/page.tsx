"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type IvrOption = { digit: string; action: string; target?: string | null; label?: string | null };
type IvrMenu = {
  id: string;
  name: string;
  greeting: string | null;
  options: IvrOption[];
  afterHoursGreeting?: string | null;
  afterHoursOptions?: IvrOption[];
  active: boolean;
  phoneNumberIds: string[];
};
type Queue = { id: string; name: string };
type PhoneNum = { id: string; e164: string; friendlyName?: string | null };

const ACTIONS = [
  { value: "agent", label: "Ring agent / AI" },
  { value: "queue", label: "Send to queue" },
  { value: "forward", label: "Forward to number" },
  { value: "voicemail", label: "Voicemail" },
  { value: "submenu", label: "Nested submenu" },
  { value: "hangup", label: "Hang up" },
];

const emptyForm = {
  name: "",
  greeting: "Thanks for calling. Press 1 for sales, press 2 for support.",
  options: [{ digit: "1", action: "agent", target: "", label: "" }] as IvrOption[],
  afterHoursGreeting: "",
  afterHoursOptions: [] as IvrOption[],
  active: true,
  phoneNumberIds: [] as string[],
};

export default function PhoneIvrPage() {
  const [menus, setMenus] = useState<IvrMenu[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [numbers, setNumbers] = useState<PhoneNum[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/phone/ivr").then((r) => r.json()).then((j) => setMenus(j.data || []));
  }

  useEffect(() => {
    load();
    fetch("/api/phone/queues").then((r) => r.json()).then((j) => setQueues(j.data || [])).catch(() => undefined);
    fetch("/api/phone/numbers").then((r) => r.json()).then((j) => setNumbers(j.data || [])).catch(() => undefined);
  }, []);

  function resetForm() {
    setForm({
      ...emptyForm,
      options: [{ digit: "1", action: "agent", target: "", label: "" }],
      afterHoursOptions: [],
    });
    setEditingId(null);
    setError("");
  }

  function startEdit(m: IvrMenu) {
    setEditingId(m.id);
    setForm({
      name: m.name,
      greeting: m.greeting || "",
      options: m.options.length ? m.options.map((o) => ({ ...o, target: o.target || "", label: o.label || "" })) : [{ digit: "1", action: "agent", target: "", label: "" }],
      afterHoursGreeting: m.afterHoursGreeting || "",
      afterHoursOptions: (m.afterHoursOptions || []).map((o) => ({
        ...o,
        target: o.target || "",
        label: o.label || "",
      })),
      active: m.active,
      phoneNumberIds: m.phoneNumberIds || [],
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateOption(idx: number, patch: Partial<IvrOption>) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));
  }

  function addOption() {
    setForm((f) => ({ ...f, options: [...f.options, { digit: "", action: "agent", target: "", label: "" }] }));
  }

  function removeOption(idx: number) {
    setForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
  }

  function toggleNumber(id: string) {
    setForm((f) => ({
      ...f,
      phoneNumberIds: f.phoneNumberIds.includes(id)
        ? f.phoneNumberIds.filter((n) => n !== id)
        : [...f.phoneNumberIds, id],
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `/api/phone/ivr/${editingId}` : "/api/phone/ivr";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          greeting: form.greeting,
          active: form.active,
          phoneNumberIds: form.phoneNumberIds,
          options: form.options.map((o) => ({
            digit: o.digit,
            action: o.action,
            target: o.target || null,
            label: o.label || null,
          })),
          afterHoursGreeting: form.afterHoursGreeting || null,
          afterHoursOptions: form.afterHoursOptions.map((o) => ({
            digit: o.digit,
            action: o.action,
            target: o.target || null,
            label: o.label || null,
          })),
        }),
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
    if (!confirm("Delete this IVR menu?")) return;
    await fetch(`/api/phone/ivr/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    load();
  }

  const actionLabel = (o: IvrOption) => {
    const base = ACTIONS.find((a) => a.value === o.action)?.label || o.action;
    if (o.action === "queue") return `${base}: ${queues.find((q) => q.id === o.target)?.name || o.target || "?"}`;
    if (o.action === "forward") return `${base}: ${o.target || "?"}`;
    if (o.action === "submenu") {
      return `${base}: ${menus.find((m) => m.id === o.target)?.name || o.target || "?"}`;
    }
    return base;
  };

  function updateAfterHoursOption(idx: number, patch: Partial<IvrOption>) {
    setForm((f) => ({
      ...f,
      afterHoursOptions: f.afterHoursOptions.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    }));
  }

  return (
    <div>
      <PageHeader
        title="IVR menus"
        description="Greet callers and route them by keypad (DTMF) selection to a queue, agent, forward, or voicemail."
      />
      <PhoneSubNav />

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <Card className="space-y-4">
          <CardTitle>{editingId ? "Edit IVR menu" : "New IVR menu"}</CardTitle>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main menu" />
          </div>
          <div>
            <Label>Greeting (text-to-speech)</Label>
            <Textarea value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} />
          </div>

          <div>
            <Label>Keypad options</Label>
            <div className="space-y-2">
              {form.options.map((o, idx) => (
                <div key={idx} className="rounded-lg border border-border p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-14 text-center"
                      value={o.digit}
                      maxLength={1}
                      placeholder="#"
                      onChange={(e) => updateOption(idx, { digit: e.target.value })}
                    />
                    <Select value={o.action} onChange={(e) => updateOption(idx, { action: e.target.value })}>
                      {ACTIONS.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => removeOption(idx)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                  {o.action === "queue" && (
                    <Select value={o.target || ""} onChange={(e) => updateOption(idx, { target: e.target.value })}>
                      <option value="">Select queue…</option>
                      {queues.map((q) => (
                        <option key={q.id} value={q.id}>{q.name}</option>
                      ))}
                    </Select>
                  )}
                  {o.action === "forward" && (
                    <Input
                      value={o.target || ""}
                      onChange={(e) => updateOption(idx, { target: e.target.value })}
                      placeholder="Forward to +1..."
                    />
                  )}
                  {o.action === "submenu" && (
                    <Select value={o.target || ""} onChange={(e) => updateOption(idx, { target: e.target.value })}>
                      <option value="">Select submenu…</option>
                      {menus
                        .filter((m) => m.id !== editingId)
                        .map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </Select>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addOption} className="mt-2 gap-1">
              <Plus className="h-3.5 w-3.5" /> Add option
            </Button>
          </div>

          <div>
            <Label>After-hours greeting (optional)</Label>
            <Textarea
              value={form.afterHoursGreeting}
              onChange={(e) => setForm({ ...form, afterHoursGreeting: e.target.value })}
              placeholder="We're closed. Press 1 for voicemail…"
            />
            <Label className="mt-2 block">After-hours options</Label>
            <div className="space-y-2">
              {form.afterHoursOptions.map((o, idx) => (
                <div key={`ah-${idx}`} className="rounded-lg border border-border p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-14 text-center"
                      value={o.digit}
                      maxLength={1}
                      onChange={(e) => updateAfterHoursOption(idx, { digit: e.target.value })}
                    />
                    <Select
                      value={o.action}
                      onChange={(e) => updateAfterHoursOption(idx, { action: e.target.value })}
                    >
                      {ACTIONS.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          afterHoursOptions: f.afterHoursOptions.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                  {(o.action === "forward" || o.action === "queue" || o.action === "submenu") && (
                    <Input
                      value={o.target || ""}
                      onChange={(e) => updateAfterHoursOption(idx, { target: e.target.value })}
                      placeholder={o.action === "forward" ? "+1..." : "Target id"}
                    />
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  afterHoursOptions: [
                    ...f.afterHoursOptions,
                    { digit: "1", action: "voicemail", target: "", label: "" },
                  ],
                }))
              }
            >
              Add after-hours option
            </Button>
          </div>

          <div>
            <Label>Assigned phone numbers</Label>
            <div className="max-h-32 space-y-1 overflow-auto rounded-lg border border-border p-2">
              {numbers.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">No phone numbers.</p>
              ) : (
                numbers.map((n) => (
                  <label key={n.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <input type="checkbox" checked={form.phoneNumberIds.includes(n.id)} onChange={() => toggleNumber(n.id)} />
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
              <Plus className="h-4 w-4" /> {editingId ? "Save changes" : "Create menu"}
            </Button>
            {editingId && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
          </div>
        </Card>

        <div className="space-y-3">
          {menus.length === 0 ? (
            <Card><p className="text-sm text-muted-foreground">No IVR menus yet. Create one to greet and route callers.</p></Card>
          ) : (
            menus.map((m) => (
              <Card key={m.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-sm font-semibold">{m.name}</h3>
                      <StatusChip status={m.active ? "Active" : "Paused"} />
                    </div>
                    {m.greeting && <p className="mt-1 max-w-lg text-xs text-muted-foreground">“{m.greeting}”</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => startEdit(m)}>Edit</Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {m.options.map((o) => (
                    <div key={o.digit} className="flex items-center gap-2 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-muted font-mono text-xs font-semibold">{o.digit}</span>
                      <span>{actionLabel(o)}</span>
                    </div>
                  ))}
                </div>
                {(m.phoneNumberIds || []).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Numbers: {m.phoneNumberIds.map((id) => numbers.find((n) => n.id === id)?.e164 || id).join(", ")}
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
