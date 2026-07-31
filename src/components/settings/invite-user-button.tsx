"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function InviteUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Inbox agent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to invite user");
      setOpen(false);
      setName("");
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        Invite user
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="inviteName">Name</Label>
        <Input id="inviteName" value={name} onChange={(e) => setName(e.target.value)} required className="w-40" />
      </div>
      <div>
        <Label htmlFor="inviteEmail">Email</Label>
        <Input id="inviteEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-48" />
      </div>
      <div>
        <Label htmlFor="inviteRole">Role</Label>
        <Select id="inviteRole" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="Owner">Owner</option>
          <option value="Campaign creator">Campaign creator</option>
          <option value="Inbox agent">Inbox agent</option>
          <option value="Analyst">Analyst</option>
          <option value="Read only">Read only</option>
        </Select>
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Inviting…" : "Send invite"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </form>
  );
}
