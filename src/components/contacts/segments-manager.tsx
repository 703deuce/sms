"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import type { SegmentSummary } from "@/lib/workspace-data";
import {
  parseSegmentConditions,
  type SegmentConditions,
  type SegmentOperator,
  type SegmentRule,
} from "@/lib/contacts/segment-query";
import { formatNumber } from "@/lib/utils";
import { Filter, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { contactTabs } from "@/lib/contact-tabs";

const STATUS_OPTIONS = ["SUBSCRIBED", "UNSUBSCRIBED", "BLOCKED", "INVALID"];

const OPERATORS: { value: SegmentOperator; label: string }[] = [
  { value: "equals", label: "is" },
  { value: "not_equals", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "exists", label: "is set" },
  { value: "not_exists", label: "is not set" },
];

type FieldOption = { value: string; label: string; kind: "status" | "tag" | "custom" };

function describeConditions(conditions: unknown): string {
  const parsed = parseSegmentConditions(conditions);
  if (!parsed.rules.length) return "All contacts";
  const joiner = parsed.match === "any" ? " OR " : " AND ";
  return parsed.rules
    .map((r) => {
      const op = OPERATORS.find((o) => o.value === r.op)?.label || r.op;
      const fieldLabel = r.field.startsWith("custom:") ? r.field.slice(7) : r.field;
      return `${fieldLabel} ${op}${r.value ? ` "${r.value}"` : ""}`;
    })
    .join(joiner);
}

type Props = {
  segments: SegmentSummary[];
};

type EditorState = {
  id: string | null;
  name: string;
  match: "all" | "any";
  rules: SegmentRule[];
};

export function SegmentsManager({ segments: initialSegments }: Props) {
  const router = useRouter();
  const [segments, setSegments] = useState(initialSegments);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([
    { value: "status", label: "Status", kind: "status" },
    { value: "tag", label: "Tag", kind: "tag" },
  ]);
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/contacts/fields")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const fields = j?.data?.fields || [];
        setFieldOptions([
          { value: "status", label: "Status", kind: "status" },
          { value: "tag", label: "Tag", kind: "tag" },
          ...fields.map((f: { key: string; name: string }) => ({
            value: `custom:${f.key}`,
            label: f.name,
            kind: "custom" as const,
          })),
        ]);
      })
      .catch(() => undefined);
    fetch("/api/contacts/tags")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setTagOptions((j?.data || []).map((t: { name: string }) => t.name)))
      .catch(() => undefined);
  }, []);

  function openCreate() {
    setEditor({
      id: null,
      name: "",
      match: "all",
      rules: [{ field: "status", op: "equals", value: "SUBSCRIBED" }],
    });
    setPreviewCount(null);
    setError("");
  }

  function openEdit(segment: SegmentSummary) {
    const parsed = parseSegmentConditions(segment.conditions);
    setEditor({
      id: segment.id,
      name: segment.name,
      match: parsed.match,
      rules: parsed.rules.length
        ? parsed.rules
        : [{ field: "status", op: "equals", value: "SUBSCRIBED" }],
    });
    setPreviewCount(null);
    setError("");
  }

  function updateRule(index: number, patch: Partial<SegmentRule>) {
    if (!editor) return;
    const rules = editor.rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setEditor({ ...editor, rules });
    setPreviewCount(null);
  }

  function addRule() {
    if (!editor) return;
    setEditor({
      ...editor,
      rules: [...editor.rules, { field: "status", op: "equals", value: "SUBSCRIBED" }],
    });
    setPreviewCount(null);
  }

  function removeRule(index: number) {
    if (!editor) return;
    setEditor({ ...editor, rules: editor.rules.filter((_, i) => i !== index) });
    setPreviewCount(null);
  }

  function conditionsPayload(): SegmentConditions {
    return {
      match: editor?.match || "all",
      rules: (editor?.rules || []).filter((r) => r.field),
    };
  }

  async function preview() {
    setPreviewing(true);
    setError("");
    try {
      const res = await fetch("/api/contacts/segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions: conditionsPayload() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Preview failed");
      setPreviewCount(json.data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function save() {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      setError("Segment name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const conditions = conditionsPayload();
      if (editor.id) {
        const res = await fetch("/api/contacts/segments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editor.id, name, conditions }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to save segment");
        setSegments((prev) =>
          prev.map((s) => (s.id === editor.id ? { ...s, name, conditions } : s)),
        );
      } else {
        const res = await fetch("/api/contacts/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, conditions }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create segment");
        setSegments((prev) => [...prev, json.data]);
      }
      setEditor(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
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

  function fieldKind(field: string): FieldOption["kind"] {
    return fieldOptions.find((f) => f.value === field)?.kind || "custom";
  }

  return (
    <div>
      <PageHeader
        title="Segments"
        description="Dynamic audiences based on status, tags, and custom fields."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create segment
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active segments" value={formatNumber(segments.length)} />
        <StatCard label="Combined reach" value="—" hint="Preview each segment for live counts" />
        <StatCard label="Most engaged" value={segments[0]?.name ?? "—"} hint="Based on segment order" />
      </div>

      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

      {editor ? (
        <Card className="mb-6 p-5">
          <CardTitle>{editor.id ? "Edit segment" : "New segment"}</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="seg-name">Segment name</Label>
              <Input
                id="seg-name"
                value={editor.name}
                placeholder="e.g. High engagement"
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span>Match</span>
              <Select
                className="w-auto"
                value={editor.match}
                onChange={(e) => setEditor({ ...editor, match: e.target.value as "all" | "any" })}
              >
                <option value="all">all</option>
                <option value="any">any</option>
              </Select>
              <span>of the following conditions</span>
            </div>

            <div className="space-y-2">
              {editor.rules.map((rule, index) => {
                const kind = fieldKind(rule.field);
                const showValue = rule.op !== "exists" && rule.op !== "not_exists";
                return (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Select
                      className="w-auto min-w-[140px]"
                      value={rule.field}
                      onChange={(e) => updateRule(index, { field: e.target.value })}
                    >
                      {fieldOptions.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      className="w-auto min-w-[130px]"
                      value={rule.op}
                      onChange={(e) => updateRule(index, { op: e.target.value as SegmentOperator })}
                    >
                      {OPERATORS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    {showValue ? (
                      kind === "status" ? (
                        <Select
                          className="w-auto min-w-[150px]"
                          value={rule.value || ""}
                          onChange={(e) => updateRule(index, { value: e.target.value })}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                      ) : kind === "tag" && tagOptions.length ? (
                        <Select
                          className="w-auto min-w-[150px]"
                          value={rule.value || ""}
                          onChange={(e) => updateRule(index, { value: e.target.value })}
                        >
                          <option value="">— any tag —</option>
                          {tagOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          className="w-auto min-w-[150px]"
                          value={rule.value || ""}
                          placeholder="value"
                          onChange={(e) => updateRule(index, { value: e.target.value })}
                        />
                      )
                    ) : null}
                    <button
                      type="button"
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-rose-600"
                      onClick={() => removeRule(index)}
                      aria-label="Remove condition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" type="button" onClick={addRule}>
                <Plus className="h-3.5 w-3.5" />
                Add condition
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button variant="outline" type="button" disabled={previewing} onClick={preview}>
                {previewing ? "Counting…" : "Preview count"}
              </Button>
              {previewCount !== null ? (
                <span className="text-sm font-medium">
                  {formatNumber(previewCount)} matching contact{previewCount === 1 ? "" : "s"}
                </span>
              ) : null}
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" type="button" onClick={() => setEditor(null)}>
                  Cancel
                </Button>
                <Button type="button" disabled={saving} onClick={save}>
                  {saving ? "Saving…" : "Save segment"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {segments.length === 0 && !editor ? (
        <EmptyState
          icon={<Filter className="h-10 w-10" />}
          title="No segments yet"
          description="Create dynamic segments to target contacts based on status, tags, and custom fields. Use the Create segment button above."
        />
      ) : (
        <Card>
          <CardTitle>Segment rules</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Segment</TH>
                <TH>Conditions</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {segments.map((segment) => (
                <TR key={segment.id}>
                  <TD className="font-medium">{segment.name}</TD>
                  <TD className="max-w-md text-muted-foreground">
                    {describeConditions(segment.conditions)}
                  </TD>
                  <TD>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        disabled={busyId === segment.id}
                        onClick={() => openEdit(segment)}
                      >
                        Edit rules
                      </Button>
                      <Link href="/send">
                        <Button variant="ghost" size="sm">
                          Campaign
                        </Button>
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
      )}
    </div>
  );
}
