"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/input";

type Props = {
  types: Array<{ id: string; name: string }>;
  onApplied: () => void;
};

export function TypeBulkEditPanel({ types, onApplied }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"" | "public" | "unlisted" | "secret">("");
  const [managed, setManaged] = useState<boolean | null>(null);
  const [approvalRequired, setApprovalRequired] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  async function apply() {
    if (!selectedIds.length) return;
    setSaving(true);
    const patch: Record<string, unknown> = { typeIds: selectedIds };
    if (visibility) patch.visibility = visibility;
    if (managed !== null) patch.managed = managed;
    if (approvalRequired !== null) patch.bookingApprovalRequired = approvalRequired;
    await fetch("/api/appointments/types/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    onApplied();
  }

  return (
    <Card className="p-5 mt-6">
      <CardTitle className="text-base mb-4">Bulk edit appointment types</CardTitle>
      <div className="space-y-3 max-h-48 overflow-y-auto border rounded-lg p-3">
        {types.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.includes(t.id)}
              onChange={(e) =>
                setSelectedIds((prev) =>
                  e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                )
              }
            />
            {t.name}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div>
          <Label>Visibility</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          >
            <option value="">No change</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="secret">Secret</option>
          </select>
        </div>
        <div>
          <Label>Managed</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={managed === null ? "" : managed ? "yes" : "no"}
            onChange={(e) =>
              setManaged(e.target.value === "" ? null : e.target.value === "yes")
            }
          >
            <option value="">No change</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div>
          <Label>Approval required</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={approvalRequired === null ? "" : approvalRequired ? "yes" : "no"}
            onChange={(e) =>
              setApprovalRequired(e.target.value === "" ? null : e.target.value === "yes")
            }
          >
            <option value="">No change</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
      <Button className="mt-4" size="sm" disabled={saving || !selectedIds.length} onClick={apply}>
        {saving ? "Applying…" : `Apply to ${selectedIds.length} type(s)`}
      </Button>
    </Card>
  );
}
