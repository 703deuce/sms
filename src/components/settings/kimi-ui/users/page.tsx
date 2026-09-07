"use client";

import { useEffect, useState } from "react";
import "./reference.css";
import {
  TEAM_MEMBERS,
  PENDING_INVITES,
  TeamMember,
  PendingInvite,
} from "./types";
import { SettingsTabs } from "./components/SettingsTabs";
import { TeamMembersTable } from "./components/TeamMembersTable";
import { InviteUserPanel } from "./components/InviteUserPanel";
import { PendingInvites } from "./components/PendingInvites";
import { RolePermissions } from "./components/RolePermissions";
import { Button, StatusChip } from "./components/ui";
import { AlertCircle, RefreshCw, Users } from "lucide-react";

type PageState = "loading" | "ready" | "error";

export default function SettingsUsersPage() {
  const [state, setState] = useState<PageState>("loading");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [savedNotice, setSavedNotice] = useState("");

  // Simulated load of /api/team
  useEffect(() => {
    const t = setTimeout(() => {
      setMembers(TEAM_MEMBERS);
      setInvites(PENDING_INVITES);
      setState("ready");
    }, 650);
    return () => clearTimeout(t);
  }, []);

  function flash(msg: string) {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(""), 2500);
  }

  async function invite(email: string, role: string) {
    await new Promise((r) => setTimeout(r, 700));
    if (email.toLowerCase().includes("taken")) {
      throw new Error("This person is already on the team.");
    }
    const inviteUrl = `https://app.transovo.com/invite/${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    setInvites((prev) => [
      ...prev,
      {
        id: `inv_${Date.now()}`,
        email,
        role: role.toUpperCase().replace(/ /g, "_"),
        invitedByName: "You",
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
    ]);
    flash("Invitation sent.");
    return { inviteUrl };
  }

  async function saveRole(membershipId: string, role: string) {
    await new Promise((r) => setTimeout(r, 500));
    setMembers((prev) =>
      prev.map((m) => (m.membershipId === membershipId ? { ...m, role } : m))
    );
    flash("Role updated.");
  }

  async function removeMember(membershipId: string) {
    await new Promise((r) => setTimeout(r, 500));
    setMembers((prev) => prev.filter((m) => m.membershipId !== membershipId));
    flash("Member removed.");
  }

  async function cancelInvite(id: string) {
    await new Promise((r) => setTimeout(r, 400));
    setInvites((prev) => prev.filter((i) => i.id !== id));
    flash("Invitation cancelled.");
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px 48px" }}>
      {/* Page header */}
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
        {state === "ready" && members.length > 0 && <InviteUserPanel onInvite={invite} />}
      </div>

      {/* Success toast (inline, non-blocking) */}
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

      <SettingsTabs active="Team" />

      {/* Error state */}
      {state === "error" && (
        <div
          className="surface"
          style={{
            padding: "24px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
          role="alert"
        >
          <AlertCircle size={20} color="var(--danger)" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 650 }}>
              Team members couldn&apos;t be loaded.
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
              Your existing team and permissions are unchanged. Try loading the list again.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setState("loading")}>
            <RefreshCw size={13} /> Retry
          </Button>
        </div>
      )}

      {/* Loading + ready */}
      {state !== "error" && (
        <>
          {state === "ready" && members.length === 0 ? (
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
              <h3 className="font-display" style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>
                No team members yet
              </h3>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  maxWidth: 380,
                  lineHeight: 1.5,
                }}
              >
                Invite colleagues to collaborate on appointments, messages, and booking
                configuration. Each person gets their own role and permissions.
              </p>
              <div style={{ marginTop: 16 }}>
                <InviteUserPanel onInvite={invite} />
              </div>
            </div>
          ) : (
            <TeamMembersTable
              members={members}
              loading={state === "loading"}
              onSaveRole={saveRole}
              onRemove={removeMember}
            />
          )}

          {state === "ready" && (
            <>
              <PendingInvites invites={invites} onCancel={cancelInvite} />
              <RolePermissions />

              {/* Permission note */}
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <StatusChip label="Note" />
                Changes to roles take effect immediately. Only Owners and Administrators can
                invite or remove team members.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
