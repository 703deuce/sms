"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import "@/components/settings/kimi-ui/users/reference.css";
import type { PendingInvite, TeamMember } from "@/components/settings/kimi-ui/users/types";
import { SettingsTabs } from "@/components/settings/kimi-ui/users/components/SettingsTabs";
import { TeamMembersTable } from "@/components/settings/kimi-ui/users/components/TeamMembersTable";
import { InviteUserPanel } from "@/components/settings/kimi-ui/users/components/InviteUserPanel";
import { PendingInvites } from "@/components/settings/kimi-ui/users/components/PendingInvites";
import { RolePermissions } from "@/components/settings/kimi-ui/users/components/RolePermissions";
import { Button } from "@/components/settings/kimi-ui/users/components/ui";
import { resolveSettingsTabs } from "@/features/settings/kimi/shared/settings-tabs";
import { AlertCircle, RefreshCw, Users } from "lucide-react";

type Props = {
  initialMembers: TeamMember[];
  initialInvites: PendingInvite[];
  hideChrome?: boolean;
};

export function UsersSettingsConnected({ initialMembers, initialInvites, hideChrome = false }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [savedNotice, setSavedNotice] = useState("");
  const [failed, setFailed] = useState(false);

  const tabs = resolveSettingsTabs();

  function flash(msg: string) {
    setSavedNotice(msg);
    window.setTimeout(() => setSavedNotice(""), 2500);
  }

  async function invite(email: string, role: string) {
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to invite user");
    router.refresh();
    flash("Invitation sent.");
    return { inviteUrl: json.inviteUrl as string | undefined };
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
    const res = await fetch(`/api/team?membershipId=${encodeURIComponent(membershipId)}`, {
      method: "DELETE",
    });
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
    <div
      style={
        hideChrome
          ? { maxWidth: "none", margin: 0, padding: 0 }
          : { maxWidth: 960, margin: "0 auto", padding: "28px 24px 48px" }
      }
    >
      {!hideChrome ? (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <h1
              className="font-display"
              style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              Users &amp; permissions
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--text-muted)", maxWidth: 520 }}>
              Manage team access, roles, and who can make changes across your workspace.
            </p>
          </div>
          {members.length > 0 && <InviteUserPanel onInvite={invite} />}
        </div>
      ) : members.length > 0 ? (
        <div className="mb-4 flex justify-end">
          <InviteUserPanel onInvite={invite} />
        </div>
      ) : null}

      {savedNotice && (
        <div
          role="status"
          className="anim-fade"
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            zIndex: 50,
            borderRadius: 10,
            background: "var(--text-primary)",
            color: "#fff",
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(16,24,40,.22)",
          }}
        >
          {savedNotice}
        </div>
      )}

      {!hideChrome ? <SettingsTabs active="Team" items={tabs} /> : null}

      {failed && (
        <div className="surface" style={{ padding: 24, display: "flex", alignItems: "center", gap: 14 }} role="alert">
          <AlertCircle size={20} color="var(--danger)" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 650 }}>Team members couldn&apos;t be loaded.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFailed(false)}>
            <RefreshCw size={13} /> Retry
          </Button>
        </div>
      )}

      {members.length === 0 ? (
        <div
          className="surface"
          style={{
            padding: "48px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            borderStyle: "dashed",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Users size={20} />
          </div>
          <h3 className="font-display" style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>No team members yet</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)", maxWidth: 380, lineHeight: 1.5 }}>
            Invite colleagues to collaborate on appointments, messages, and booking configuration.
          </p>
          <div style={{ marginTop: 16 }}>
            <InviteUserPanel onInvite={invite} />
          </div>
        </div>
      ) : (
        <TeamMembersTable
          members={members}
          loading={false}
          onSaveRole={saveRole}
          onRemove={removeMember}
        />
      )}

      <PendingInvites invites={invites} onCancel={cancelInvite} />
      <RolePermissions />
    </div>
  );
}
