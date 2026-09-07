"use client";

import { useState } from "react";
import { ROLES } from "../types";
import { Button, Input, Label, Select } from "./ui";
import { UserPlus, Copy, Check } from "lucide-react";

export function InviteUserPanel({
  onInvite,
}: {
  onInvite: (email: string, role: string) => Promise<{ inviteUrl?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Inbox agent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setInviteLink("");
    try {
      const res = await onInvite(email, role);
      setEmail("");
      if (res.inviteUrl) setInviteLink(res.inviteUrl);
      else setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send invite. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus size={15} strokeWidth={2.2} />
        Invite user
      </Button>
    );
  }

  return (
    <div
      className="anim-fade surface"
      style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}
    >
      <form onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12 }}>
        <div style={{ flex: "1 1 220px" }}>
          <Label htmlFor="inviteEmail">Email address</Label>
          <Input
            id="inviteEmail"
            type="email"
            required
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 1 180px" }}>
          <Label htmlFor="inviteRole">Role</Label>
          <Select id="inviteRole" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Inviting…" : "Send invite"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setInviteLink("");
            setError("");
          }}
        >
          Cancel
        </Button>
      </form>
      {error && <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>{error}</p>}
      {inviteLink && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            borderRadius: 8,
            background: "var(--success-soft)",
            padding: "9px 12px",
          }}
        >
          <span style={{ fontSize: 12.5, color: "var(--success)", fontWeight: 600 }}>
            Invite created.
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              color: "var(--text-primary)",
              wordBreak: "break-all",
              flex: 1,
              minWidth: 200,
            }}
          >
            {inviteLink}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(inviteLink).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  );
}
