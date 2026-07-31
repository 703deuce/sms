"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import type { CustomFieldDefinition } from "@/lib/contacts/custom-fields";
import { Plus } from "lucide-react";
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

type Props = {
  initialFields: CustomFieldDefinition[];
};

export function FieldsManager({ initialFields }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState({
    name: "",
    key: "",
    type: "Text",
    usedIn: "",
  });

  const customCount = fields.filter((f) => !f.system).length;
  const automationFields = fields.filter(
    (f) => f.usedIn?.toLowerCase().includes("automation") || f.usedIn?.toLowerCase().includes("birthday"),
  );

  async function persist(next: CustomFieldDefinition[]) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/contacts/fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setFields(json.data.fields);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function addField() {
    const name = newField.name.trim();
    if (!name) return;
    const key =
      newField.key.trim() ||
      name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
    const row: CustomFieldDefinition = {
      key,
      name,
      type: newField.type,
      required: false,
      usedIn: newField.usedIn.trim() || "Merge tags, segments",
      system: false,
    };
    const next = [...fields, row];
    setShowAdd(false);
    setNewField({ name: "", key: "", type: "Text", usedIn: "" });
    persist(next);
  }

  function removeField(key: string) {
    const field = fields.find((f) => f.key === key);
    if (field?.system) return;
    persist(fields.filter((f) => f.key !== key));
  }

  return (
    <div>
      <PageHeader
        title="Custom fields"
        description="Extend contact profiles with business-specific data for merge tags and segmentation."
        actions={
          <Button onClick={() => setShowAdd(true)} disabled={saving}>
            <Plus className="h-4 w-4" />
            Add field
          </Button>
        }
      />

      <Tabs items={contactTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total fields" value={fields.length} />
        <StatCard label="Custom fields" value={customCount} />
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Used in automations
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{automationFields.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {automationFields.map((f) => f.name).join(", ") || "None yet"}
          </p>
        </Card>
      </div>

      {showAdd ? (
        <Card className="mb-4">
          <CardTitle>New custom field</CardTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Field name"
              value={newField.name}
              onChange={(e) => setNewField((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              placeholder="Key (optional)"
              value={newField.key}
              onChange={(e) => setNewField((p) => ({ ...p, key: e.target.value }))}
            />
            <select
              className="h-10 rounded-[10px] border border-border bg-card px-3 text-sm"
              value={newField.type}
              onChange={(e) => setNewField((p) => ({ ...p, type: e.target.value }))}
            >
              <option>Text</option>
              <option>Date</option>
              <option>Dropdown</option>
              <option>Number</option>
            </select>
            <Input
              placeholder="Used in"
              value={newField.usedIn}
              onChange={(e) => setNewField((p) => ({ ...p, usedIn: e.target.value }))}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={addField} disabled={saving}>Save field</Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}

      <Card>
        <CardTitle>Field definitions</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Field name</TH>
              <TH>Key</TH>
              <TH>Type</TH>
              <TH>Required</TH>
              <TH>Used in</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <TBody>
            {fields.map((field) => (
              <TR key={field.key}>
                <TD>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{field.name}</span>
                    {field.system ? (
                      <StatusChip status="Active" className="text-[10px]" />
                    ) : null}
                  </div>
                </TD>
                <TD className="font-mono text-xs text-muted-foreground">{`{{${field.key}}}`}</TD>
                <TD>{field.type}</TD>
                <TD>{field.required ? "Yes" : "No"}</TD>
                <TD className="text-muted-foreground">{field.usedIn || "—"}</TD>
                <TD>
                  {field.system ? (
                    <span className="text-xs text-muted-foreground">System field</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(field.key)}
                      disabled={saving}
                    >
                      Delete
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
