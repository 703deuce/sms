"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
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
};

export default function GrowPopupsPage() {
  const [rows, setRows] = useState<WidgetRow[]>([]);
  const [name, setName] = useState("Website popup");
  const [widgetType, setWidgetType] = useState("popup");

  function load() {
    fetch("/api/grow/widgets").then((r) => r.json()).then((j) => setRows(j.data || []));
  }

  useEffect(() => { load(); }, []);

  async function create() {
    await fetch("/api/grow/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, widgetType }),
    });
    load();
  }

  async function publish(id: string) {
    await fetch(`/api/grow/widgets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    load();
  }

  const embedBase = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <PageHeader
        title="Popups & widgets"
        description="Embedded forms, popups, slide-ins, exit-intent, and floating text-us buttons for your website."
      />
      <Tabs items={growTabs} />
      <Card className="mb-6 grid gap-3 p-5 sm:grid-cols-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Type</Label>
          <select
            className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
            value={widgetType}
            onChange={(e) => setWidgetType(e.target.value)}
          >
            <option value="popup">Popup</option>
            <option value="slide-in">Slide-in</option>
            <option value="floating">Floating button</option>
            <option value="exit-intent">Exit intent</option>
            <option value="embed">Embedded form</option>
          </select>
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button onClick={create}><Plus className="h-4 w-4" /> Create widget</Button>
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Type</TH>
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
                  {r.status !== "active" ? (
                    <Button size="sm" variant="outline" onClick={() => publish(r.id)}>Publish</Button>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
