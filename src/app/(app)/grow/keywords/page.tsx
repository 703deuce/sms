"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { Hash, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { leadCaptureTabs } from "@/lib/lead-capture-tabs";

type KeywordRow = {
  id: string;
  keyword: string;
  phoneNumber: string;
  listName: string;
  confirmation: string;
  status: string;
  subscribers: number;
};

type CampaignOption = { id: string; name: string; status: string };

export default function KeywordsPage() {
  const [rows, setRows] = useState<KeywordRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [keyword, setKeyword] = useState("JOIN");
  const [listName, setListName] = useState("Keyword subscribers");
  const [confirmation, setConfirmation] = useState(
    "You're subscribed! Reply STOP to opt out. Msg&data rates may apply.",
  );
  const [startCampaignId, setStartCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/growth/keywords");
    if (!res.ok) return;
    const json = await res.json();
    setRows(json.data || []);
  }

  async function loadCampaigns() {
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) return;
      const json = await res.json();
      setCampaigns(json.data || []);
    } catch {
      // optional
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    loadCampaigns();
  }, []);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/growth/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          listName,
          confirmation,
          autoReply: confirmation,
          startCampaignId: startCampaignId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setKeyword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const totalSubscribers = rows.reduce((sum, k) => sum + (k.subscribers || 0), 0);

  return (
    <div>
      <PageHeader
        title="Keywords"
        description="Contacts text a keyword (JOIN, QUOTE, BOOK…) to opt in, join a list, store consent, and optionally start a welcome workflow."
      />
      <Tabs items={leadCaptureTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active keywords" value={formatNumber(rows.length)} />
        <StatCard label="Total subscribers" value={formatNumber(totalSubscribers)} />
        <StatCard label="Runtime" value="Live" hint="Wired to inbound SMS" />
      </div>

      <Card className="mb-6 p-5">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-primary" />
          <CardTitle>Create keyword</CardTitle>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="keyword">Keyword</Label>
            <Input
              id="keyword"
              className="uppercase"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <Label htmlFor="list">List name</Label>
            <Input id="list" value={listName} onChange={(e) => setListName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="start-campaign">Start campaign / workflow (optional)</Label>
            <select
              id="start-campaign"
              className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm"
              value={startCampaignId}
              onChange={(e) => setStartCampaignId(e.target.value)}
            >
              <option value="">— none —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              When someone texts this keyword, they&apos;ll be enrolled into the selected campaign.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="confirm">Auto-reply / confirmation</Label>
            <Textarea
              id="confirm"
              rows={3}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <Button className="mt-4" disabled={saving} onClick={create}>
          <Plus className="h-4 w-4" />
          {saving ? "Saving…" : "Create keyword"}
        </Button>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Keyword</TH>
              <TH>List</TH>
              <TH>Subscribers</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((k) => (
              <TR key={k.id}>
                <TD className="font-medium">{k.keyword}</TD>
                <TD>{k.listName}</TD>
                <TD>{k.subscribers}</TD>
                <TD>
                  <StatusChip status={k.status} />
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD colSpan={4} className="text-slate-500">
                  No keywords yet — create JOIN to start collecting opt-ins.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
