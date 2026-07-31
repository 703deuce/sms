"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import type { SegmentSummary } from "@/lib/workspace-data";
import { formatNumber } from "@/lib/utils";
import { Filter, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const contactTabs = [
  { label: "All Contacts", href: "/contacts" },
  { label: "Lists", href: "/contacts/lists" },
  { label: "Segments", href: "/contacts/segments" },
  { label: "Tags", href: "/contacts/tags" },
  { label: "Imports", href: "/contacts/imports" },
  { label: "Custom Fields", href: "/contacts/fields" },
];

function formatConditions(conditions: unknown): string {
  if (!conditions) return "—";
  if (typeof conditions === "string") return conditions;
  if (typeof conditions === "object") {
    const obj = conditions as Record<string, unknown>;
    if (Object.keys(obj).length === 0) return "No conditions defined";
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" · ");
  }
  return String(conditions);
}

type Props = {
  segments: SegmentSummary[];
};

export function SegmentsManager({ segments: initialSegments }: Props) {
  const router = useRouter();
  const [segments, setSegments] = useState(initialSegments);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function createSegment() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/contacts/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create segment");
      setSegments((prev) => [...prev, json.data]);
      setNewName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function renameSegment(id: string, currentName: string) {
    const name = prompt("Segment name", currentName);
    if (!name?.trim() || name.trim() === currentName) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/contacts/segments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update segment");
      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, name: json.data.name } : s)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSegment(id: string, name: string) {
    if (!confirm(`Delete segment "${name}"?`)) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/contacts/segments?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete segment");
      setSegments((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Segments"
        description="Dynamic audiences based on behavior, engagement, and contact properties."
        actions={
          <Button type="button" onClick={() => document.getElementById("new-segment-name")?.focus()}>
            <Plus className="h-4 w-4" />
            Create segment
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active segments" value={formatNumber(segments.length)} />
        <StatCard label="Combined reach" value="—" hint="Contact counts computed at send time" />
        <StatCard label="Most engaged" value={segments[0]?.name ?? "—"} hint="Based on segment order" />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="new-segment-name" className="mb-1.5 block text-sm font-medium">
              New segment name
            </label>
            <Input
              id="new-segment-name"
              placeholder="e.g. High engagement"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <Button type="button" disabled={creating || !newName.trim()} onClick={createSegment}>
            {creating ? "Creating…" : "Add segment"}
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </Card>

      {segments.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-10 w-10" />}
          title="No segments yet"
          description="Create dynamic segments to target contacts based on rules and behavior."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {segments.map((segment) => (
              <Card key={segment.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Filter className="h-5 w-5" />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={busyId === segment.id}
                    onClick={() => renameSegment(segment.id, segment.name)}
                  >
                    Edit rules
                  </Button>
                </div>
                <CardTitle className="mt-4">{segment.name}</CardTitle>
                <p className="mt-2 font-display text-2xl font-semibold">—</p>
                <p className="text-xs text-muted-foreground">matching contacts</p>
                <div className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Conditions
                  </p>
                  <p className="mt-1 text-sm">{formatConditions(segment.conditions)}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href="/contacts">
                    <Button variant="outline" size="sm">Preview contacts</Button>
                  </Link>
                  <Link href="/send">
                    <Button size="sm">Use in campaign</Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="text-danger"
                    disabled={busyId === segment.id}
                    onClick={() => deleteSegment(segment.id, segment.name)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-6">
            <CardTitle>Segment rules</CardTitle>
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Segment</TH>
                  <TH>Count</TH>
                  <TH>Conditions</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {segments.map((segment) => (
                  <TR key={segment.id}>
                    <TD className="font-medium">{segment.name}</TD>
                    <TD>—</TD>
                    <TD className="max-w-md text-muted-foreground">
                      {formatConditions(segment.conditions)}
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          disabled={busyId === segment.id}
                          onClick={() => renameSegment(segment.id, segment.name)}
                        >
                          Edit
                        </Button>
                        <Link href="/send">
                          <Button variant="ghost" size="sm">Campaign</Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="text-danger"
                          disabled={busyId === segment.id}
                          onClick={() => deleteSegment(segment.id, segment.name)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
