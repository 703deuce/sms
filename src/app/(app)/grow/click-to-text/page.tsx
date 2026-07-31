"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { Copy, MessageSquarePlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { growTabs } from "@/lib/grow-tabs";

type LinkRow = {
  id: string;
  name: string;
  phoneE164: string;
  body: string;
  href: string;
  clicks: number;
};

export default function ClickToTextPage() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [name, setName] = useState("Website JOIN button");
  const [phoneE164, setPhoneE164] = useState("");
  const [body, setBody] = useState("JOIN");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/growth/click-to-text");
    if (!res.ok) return;
    const json = await res.json();
    setRows(json.data || []);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/growth/click-to-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phoneE164, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Click-to-text / tap-to-join"
        description="Generate links like sms:+17035551234?body=JOIN for websites, social profiles, ads, and digital business cards."
      />
      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Links" value={formatNumber(rows.length)} />
        <StatCard label="Tracked clicks" value={formatNumber(rows.reduce((s, r) => s + r.clicks, 0))} />
      </div>

      <Card className="mb-6 space-y-4 p-5">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4" />
          <CardTitle>Create link</CardTitle>
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="phone">Business number (E.164)</Label>
          <Input
            id="phone"
            placeholder="+17035551234"
            value={phoneE164}
            onChange={(e) => setPhoneE164(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="body">Prefill body</Label>
          <Input id="body" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button disabled={saving || !phoneE164} onClick={create}>
          <Plus className="h-4 w-4" />
          Create link
        </Button>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Link</TH>
              <TH>Clicks</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.name}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <code className="max-w-[280px] truncate text-xs">{r.href}</code>
                    <button type="button" onClick={() => navigator.clipboard.writeText(r.href)}>
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  </div>
                </TD>
                <TD>{r.clicks}</TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD colSpan={3} className="text-slate-500">
                  No click-to-text links yet.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
