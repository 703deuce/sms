"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/utils";
import { Trophy, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { growTabs } from "@/lib/grow-tabs";

type ContestRow = {
  id: string;
  name: string;
  keywordText: string;
  status: string;
  startAt: string | null;
  endAt: string | null;
  maxEntries: number | null;
  winnerCount: number;
  rulesText: string | null;
  prizeDescription: string | null;
  winnerContactIds: string[];
  drawnAt: string | null;
  entryCount: number;
};

type Entry = { id: string; phone: string; contactId: string | null; createdAt: string };
type Winner = { id: string; name: string; phone: string };

export default function GrowContestsPage() {
  const [rows, setRows] = useState<ContestRow[]>([]);
  const [name, setName] = useState("");
  const [keywordText, setKeywordText] = useState("WIN");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [winnerCount, setWinnerCount] = useState(1);
  const [prizeDescription, setPrizeDescription] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/grow/contests");
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
      const res = await fetch("/api/grow/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          keywordText,
          startAt: startAt || undefined,
          endAt: endAt || undefined,
          winnerCount: Number(winnerCount) || 1,
          prizeDescription: prizeDescription || undefined,
          rulesText: rulesText || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setName("");
      setPrizeDescription("");
      setRulesText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/grow/contests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function openDetail(id: string) {
    setSelected(id);
    setDetailLoading(true);
    setEntries([]);
    setWinners([]);
    try {
      const res = await fetch(`/api/grow/contests/${id}`);
      const json = await res.json();
      setEntries(json.data?.entries || []);
      setWinners(json.data?.winners || []);
    } finally {
      setDetailLoading(false);
    }
  }

  async function drawWinners(id: string) {
    if (!confirm("Draw winners now? This ends the contest.")) return;
    const res = await fetch(`/api/grow/contests/${id}/draw`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Failed to draw");
      return;
    }
    await load();
    await openDetail(id);
  }

  const totalEntries = rows.reduce((sum, c) => sum + (c.entryCount || 0), 0);
  const active = rows.filter((c) => c.status === "active").length;

  return (
    <div>
      <PageHeader
        title="Contests & text-to-win"
        description="Run sweepstakes and text-to-win campaigns. Entrants text a keyword; draw random winners when you're ready."
      />
      <Tabs items={growTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Contests" value={formatNumber(rows.length)} />
        <StatCard label="Active" value={formatNumber(active)} />
        <StatCard label="Total entries" value={formatNumber(totalEntries)} />
      </div>

      <Card className="mb-6 p-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <CardTitle>Create contest</CardTitle>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer giveaway" />
          </div>
          <div>
            <Label htmlFor="c-keyword">Keyword</Label>
            <Input
              id="c-keyword"
              className="uppercase"
              value={keywordText}
              onChange={(e) => setKeywordText(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <Label htmlFor="c-start">Start (optional)</Label>
            <Input id="c-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-end">End (optional)</Label>
            <Input id="c-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-winners">Winner count</Label>
            <Input
              id="c-winners"
              type="number"
              min={1}
              value={winnerCount}
              onChange={(e) => setWinnerCount(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="c-prize">Prize</Label>
            <Input
              id="c-prize"
              value={prizeDescription}
              onChange={(e) => setPrizeDescription(e.target.value)}
              placeholder="$100 gift card"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="c-rules">Rules / disclosure</Label>
            <Textarea
              id="c-rules"
              rows={3}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder="No purchase necessary. Msg&data rates may apply. Reply STOP to opt out."
            />
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <Button className="mt-4" disabled={saving || !name.trim() || !keywordText.trim()} onClick={create}>
          <Plus className="h-4 w-4" />
          {saving ? "Saving…" : "Create contest"}
        </Button>
      </Card>

      <Card className="mb-6 overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Contest</TH>
              <TH>Keyword</TH>
              <TH>Entries</TH>
              <TH>Winners</TH>
              <TH>Status</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">
                  <button type="button" className="text-primary hover:underline" onClick={() => openDetail(c.id)}>
                    {c.name}
                  </button>
                  {c.prizeDescription ? (
                    <span className="block text-xs text-muted-foreground">{c.prizeDescription}</span>
                  ) : null}
                </TD>
                <TD className="font-mono text-xs">{c.keywordText}</TD>
                <TD>{formatNumber(c.entryCount)}</TD>
                <TD>{c.winnerContactIds.length ? formatNumber(c.winnerContactIds.length) : c.winnerCount}</TD>
                <TD>
                  <StatusChip status={c.status} />
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {c.status !== "active" && c.status !== "ended" ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "active")}>
                        Activate
                      </Button>
                    ) : null}
                    {c.status === "active" ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "paused")}>
                        Pause
                      </Button>
                    ) : null}
                    {c.status !== "ended" ? (
                      <Button size="sm" onClick={() => drawWinners(c.id)} disabled={c.entryCount === 0}>
                        Draw winners
                      </Button>
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <TR>
                <TD colSpan={6} className="text-slate-500">
                  No contests yet — create one and share the keyword to start collecting entries.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>

      {selected ? (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <CardTitle>Contest detail</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          {detailLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="mt-4 space-y-4">
              {winners.length > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-semibold">Winners</p>
                  <ul className="space-y-1 text-sm">
                    {winners.map((w) => (
                      <li key={w.id} className="rounded-md bg-violet-50 px-3 py-1.5">
                        {w.name} · <span className="font-mono">{w.phone}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div>
                <p className="mb-2 text-sm font-semibold">Entries ({entries.length})</p>
                <Table>
                  <THead>
                    <TR>
                      <TH>Phone</TH>
                      <TH>Entered</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {entries.map((e) => (
                      <TR key={e.id}>
                        <TD className="font-mono text-xs">{e.phone}</TD>
                        <TD className="text-xs text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString()}
                        </TD>
                      </TR>
                    ))}
                    {entries.length === 0 && (
                      <TR>
                        <TD colSpan={2} className="text-slate-500">
                          No entries yet.
                        </TD>
                      </TR>
                    )}
                  </TBody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
