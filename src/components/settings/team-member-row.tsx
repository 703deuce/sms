"use client";

import { Button } from "@/components/ui/button";
import { TR, TD } from "@/components/ui/table";
import { Select } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLES = [
  "Owner",
  "Administrator",
  "Manager",
  "Campaign creator",
  "Inbox agent",
  "Analyst",
  "Read only",
];

type Props = {
  membershipId: string;
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
};

export function TeamMemberRow({ membershipId, name, email, role, isAdmin }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState(role);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  async function saveRole() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, role: selectedRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update role");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember() {
    if (!confirm(`Remove ${name} from this workspace?`)) return;
    setRemoving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/team?membershipId=${encodeURIComponent(membershipId)}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to remove member");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setRemoving(false);
    }
  }

  if (editing) {
    return (
      <TR>
        <TD className="font-medium">{name}</TD>
        <TD className="text-muted-foreground">{email}</TD>
        <TD>
          <Select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-40"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </TD>
        <TD>{isAdmin ? "Yes" : "—"}</TD>
        <TD className="text-right">
          <div className="flex justify-end gap-1">
            <Button type="button" size="sm" disabled={saving} onClick={saveRole}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedRole(role);
                setEditing(false);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
          {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
        </TD>
      </TR>
    );
  }

  return (
    <TR>
      <TD className="font-medium">{name}</TD>
      <TD className="text-muted-foreground">{email}</TD>
      <TD>
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
          {role}
        </span>
      </TD>
      <TD>{isAdmin ? "Yes" : "—"}</TD>
      <TD className="text-right">
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-danger"
            disabled={removing}
            onClick={removeMember}
          >
            {removing ? "Removing…" : "Remove"}
          </Button>
        </div>
        {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      </TD>
    </TR>
  );
}
