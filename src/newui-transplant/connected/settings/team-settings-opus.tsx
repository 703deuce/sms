"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PendingInvite, TeamMember } from "@/components/settings/kimi-ui/users/types";
import { FieldRow, Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/newui-transplant/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/newui-transplant/components/ui/table";

const ROLES = ["owner", "admin", "member", "staff"] as const;

type Props = {
  initialMembers: TeamMember[];
  initialInvites: PendingInvite[];
};

export function TeamSettingsOpus({ initialMembers, initialInvites }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [notice, setNotice] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [busy, setBusy] = useState(false);

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2500);
  }

  async function invite() {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to invite user");
      setInviteEmail("");
      router.refresh();
      flash("Invitation sent.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveRole(membershipId: string, role: string) {
    const res = await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId, role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to update role");
    setMembers((prev) => prev.map((m) => (m.membershipId === membershipId ? { ...m, role } : m)));
    flash("Role updated.");
  }

  async function removeMember(membershipId: string) {
    const res = await fetch(`/api/team?membershipId=${encodeURIComponent(membershipId)}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Failed to remove member");
    setMembers((prev) => prev.filter((m) => m.membershipId !== membershipId));
    router.refresh();
    flash("Member removed.");
  }

  async function cancelInvite(id: string) {
    const res = await fetch(`/api/team?inviteId=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to cancel invite");
    setInvites((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
    flash("Invitation cancelled.");
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm" role="status">{notice}</p>
      ) : null}

      <Panel title="Invite teammate" description="Send an email invitation with a workspace role.">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" disabled={busy || !inviteEmail.trim()} onClick={() => void invite()}>
            Send invite
          </Button>
        </div>
      </Panel>

      <Panel title="Team members" description="Active users in this workspace.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.membershipId}>
                <TableCell className="font-medium">{m.name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{m.email}</TableCell>
                <TableCell>
                  <Select value={m.role} onValueChange={(role) => void saveRole(m.membershipId, role)}>
                    <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="sm" onClick={() => void removeMember(m.membershipId)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <Panel title="Pending invitations">
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell>{inv.role}</TableCell>
                  <TableCell><Pill tone="warning">Pending</Pill></TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => void cancelInvite(inv.id)}>
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel title="Role permissions" description="Summary of what each role can do in Transovo.">
        <FieldRow label="Owner" description="Full billing, compliance, and workspace deletion." />
        <FieldRow label="Admin" description="Manage team, settings, and all products." />
        <FieldRow label="Member" description="Operational access to assigned products." />
        <FieldRow label="Staff" description="Limited operational access without billing changes." />
      </Panel>
    </div>
  );
}
