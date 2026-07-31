"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Copy, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { growTabs } from "@/lib/grow-tabs";

type WidgetRow = {
  id: string;
  name: string;
  slug: string;
  widgetType: string;
  status: string;
  views: number;
  conversions: number;
  linkedFormId: string | null;
  config: Record<string, unknown> | null;
};

type FormOption = { id: string; name: string; slug: string | null };

export default function GrowPopupsPage() {
  const [rows, setRows] = useState<WidgetRow[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [name, setName] = useState("Website popup");
  const [widgetType, setWidgetType] = useState("popup");
  const [linkedFormId, setLinkedFormId] = useState("");
  const [exitIntent, setExitIntent] = useState(false);
  const [editing, setEditing] = useState<WidgetRow | null>(null);

  function load() {
    fetch("/api/grow/widgets").then((r) => r.json()).then((j) => setRows(j.data || []));
  }

  function loadForms() {
    fetch("/api/growth/forms")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setForms(j.data || []))
      .catch(() => setForms([]));
  }

  useEffect(() => {
    load();
    loadForms();
  }, []);

  async function create() {
    await fetch("/api/grow/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        widgetType,
        linkedFormId: linkedFormId || undefined,
        config: { exitIntent: widgetType === "exit-intent" || exitIntent },
      }),
    });
    setLinkedFormId("");
    setExitIntent(false);
    load();
  }

  async function patch(id: string, data: Record<string, unknown>) {
    await fetch(`/api/grow/widgets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    load();
  }

  async function saveEdit() {
    if (!editing) return;
    await patch(editing.id, {
      name: editing.name,
      widgetType: editing.widgetType,
      linkedFormId: editing.linkedFormId || null,
      status: editing.status,
      config: {
        ...(editing.config || {}),
        exitIntent:
          editing.widgetType === "exit-intent" ||
          Boolean((editing.config || {}).exitIntent),
      },
    });
    setEditing(null);
  }

  const embedBase = typeof window !== "undefined" ? window.location.origin : "";
  const formName = (id: string | null) =>
    id ? forms.find((f) => f.id === id)?.name || "Linked form" : "— none —";

  return (
    <div>
      <PageHeader
        title="Popups & widgets"
        description="Embedded forms, popups, slide-ins, exit-intent, and floating text-us buttons for your website."
      />
      <Tabs items={growTabs} />
      <Card className="mb-6 grid gap-3 p-5 sm:grid-cols-5">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={widgetType} onChange={(e) => setWidgetType(e.target.value)}>
            <option value="popup">Popup</option>
            <option value="slide-in">Slide-in</option>
            <option value="floating">Floating button</option>
            <option value="exit-intent">Exit intent</option>
            <option value="embed">Embedded form</option>
          </Select>
        </div>
        <div>
          <Label>Linked form</Label>
          <Select value={linkedFormId} onChange={(e) => setLinkedFormId(e.target.value)}>
            <option value="">— select form —</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={exitIntent || widgetType === "exit-intent"}
              disabled={widgetType === "exit-intent"}
              onChange={(e) => setExitIntent(e.target.checked)}
            />
            Exit intent
          </label>
        </div>
        <div className="flex items-end">
          <Button onClick={create} disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Create
          </Button>
        </div>
      </Card>

      {forms.length === 0 ? (
        <Card className="mb-6 p-4 text-sm text-muted-foreground">
          No forms yet. Create an opt-in form first so your widget has something to collect signups
          with.
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Linked form</TH>
              <TH>Status</TH>
              <TH>Views</TH>
              <TH>Conversions</TH>
              <TH>Embed</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.name}</TD>
                <TD className="capitalize">{r.widgetType.replace("-", " ")}</TD>
                <TD className={r.linkedFormId ? "" : "text-rose-600"}>{formName(r.linkedFormId)}</TD>
                <TD><StatusChip status={r.status} /></TD>
                <TD>{r.views}</TD>
                <TD>{r.conversions}</TD>
                <TD>
                  <code className="text-xs">{embedBase}/embed/w/{r.slug}</code>
                  <button
                    type="button"
                    className="ml-2 text-muted-foreground hover:text-foreground"
                    onClick={() => navigator.clipboard.writeText(`${embedBase}/embed/w/${r.slug}`)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </TD>
                <TD>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                    {r.status !== "active" ? (
                      <Button size="sm" variant="outline" onClick={() => patch(r.id, { status: "active" })}>
                        Publish
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => patch(r.id, { status: "draft" })}>
                        Unpublish
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD colSpan={8} className="text-slate-500">
                  No widgets yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md space-y-4 p-5">
            <p className="text-base font-semibold">Edit widget</p>
            <div>
              <Label>Name</Label>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={editing.widgetType}
                onChange={(e) => setEditing({ ...editing, widgetType: e.target.value })}
              >
                <option value="popup">Popup</option>
                <option value="slide-in">Slide-in</option>
                <option value="floating">Floating button</option>
                <option value="exit-intent">Exit intent</option>
                <option value="embed">Embedded form</option>
              </Select>
            </div>
            <div>
              <Label>Linked form</Label>
              <Select
                value={editing.linkedFormId || ""}
                onChange={(e) => setEditing({ ...editing, linkedFormId: e.target.value || null })}
              >
                <option value="">— select form —</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={
                  editing.widgetType === "exit-intent" ||
                  Boolean((editing.config || {}).exitIntent)
                }
                disabled={editing.widgetType === "exit-intent"}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    config: { ...(editing.config || {}), exitIntent: e.target.checked },
                  })
                }
              />
              Trigger on exit intent
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
