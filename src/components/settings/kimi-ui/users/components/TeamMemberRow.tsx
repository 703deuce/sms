"use client";

import { useState } from "react";
import { TeamMember, ROLES } from "../types";
import { Avatar, Button, Select, StatusChip } from "./ui";

export function TeamMemberRow({
  member,
  readOnly,
  onSaveRole,
  onRemove,
}: {
  member: TeamMember;
  readOnly?: boolean;
  onSaveRole: (membershipId: string, role: string) => Promise<void>;
  onRemove: (membershipId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState(member.role);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function saveRole() {
    setSaving(true);
    setError("");
    try {
      await onSaveRole(member.membershipId, selectedRole);
      setEditing(false);
    } catch {
      setError("Couldn't update role. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember() {
    setRemoving(true);
    setError("");
    try {
      await onRemove(member.membershipId);
    } catch {
      setError("Couldn't remove member. Try again.");
      setRemoving(false);
    }
  }

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      {/* Name + email */}
      <td style={{ padding: "12px 16px 12px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={member.name} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{member.name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{member.email}</div>
          </div>
        </div>
      </td>
      {/* Role */}
      <td style={{ padding: "12px 16px" }}>
        {editing ? (
          <Select
            aria-label={`Role for ${member.name}`}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            style={{ width: 160, height: 32, fontSize: 12.5 }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        ) : (
          <StatusChip label={member.role} tone={member.role === "Owner" ? "accent" : "neutral"} />
        )}
      </td>
      {/* Admin */}
      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
        {member.isAdmin ? "Yes" : "—"}
      </td>
      {/* Last active */}
      <td style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--text-muted)" }}>
        {member.lastActive}
      </td>
      {/* Actions */}
      <td style={{ padding: "12px 20px 12px 16px", textAlign: "right" }}>
        {readOnly ? null : editing ? (
          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Button size="sm" disabled={saving} onClick={saveRole}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedRole(member.role);
                setEditing(false);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        ) : confirming ? (
          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Remove {member.name.split(" ")[0]}?</span>
            <Button size="sm" variant="danger" disabled={removing} onClick={removeMember}>
              {removing ? "Removing…" : "Remove"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <div style={{ display: "inline-flex", gap: 2 }}>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {member.role !== "Owner" && (
              <Button
                size="sm"
                variant="ghost"
                style={{ color: "var(--danger)" }}
                onClick={() => setConfirming(true)}
              >
                Remove
              </Button>
            )}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--danger)" }}>{error}</div>
        )}
      </td>
    </tr>
  );
}
