"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import {
  type SchedulingGroup, type TeamBookingPage, type BookingTypeLite, staffMembers,
} from "../types";
import { GroupCard } from "./GroupCard";
import { PageCard } from "./PageCard";
import { AddGroupModal } from "./AddGroupModal";
import { AddPageModal } from "./AddPageModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { SkeletonCards, EmptyState, ErrorState, PartialNotice } from "./States";

type LoadState = "loading" | "ready" | "error";

export function TeamPagesClient({ workspaceSlug }: { workspaceSlug: string }) {
  const [groups, setGroups] = useState<SchedulingGroup[]>([]);
  const [pages, setPages] = useState<TeamBookingPage[]>([]);
  const [types, setTypes] = useState<BookingTypeLite[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [typesDegraded, setTypesDegraded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [deleteGroup, setDeleteGroup] = useState<SchedulingGroup | null>(null);
  const [deletePage, setDeletePage] = useState<TeamBookingPage | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [teamRes, typesRes] = await Promise.all([
        fetch("/api/appointments/team-pages"),
        fetch("/api/appointments/types"),
      ]);
      if (teamRes.ok) {
        const json = await teamRes.json();
        const groupsRes = await fetch("/api/appointments/team-pages?kind=groups");
        const groupsJson = groupsRes.ok ? await groupsRes.json() : { data: [] };
        setPages(json.data || []);
        setGroups(groupsJson.data || []);
      }
      if (!typesRes.ok) setTypesDegraded(true);
      else {
        const typesJson = await typesRes.json();
        setTypes(
          (typesJson.data || []).map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          })),
        );
        setTypesDegraded(false);
      }
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  // savePage / saveGroup — Cursor wires to POST /api/appointments/team-pages
  async function savePage(page: TeamBookingPage) {
    setSaving(true);
    await fetch("/api/appointments/team-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: page }),
    });
    setSaving(false);
    showToast("Booking page saved.");
    await load();
  }

  async function saveGroup(group: SchedulingGroup) {
    setSaving(true);
    await fetch("/api/appointments/team-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "group", data: group }),
    });
    setSaving(false);
    showToast("Scheduling group saved.");
    await load();
  }

  async function createPage(page: TeamBookingPage) {
    setSaving(true);
    await fetch("/api/appointments/team-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: page }),
    });
    setSaving(false);
    setAddPageOpen(false);
    showToast("Team booking page created.");
    await load();
  }

  async function createGroup(group: SchedulingGroup) {
    setSaving(true);
    await fetch("/api/appointments/team-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "group", data: group }),
    });
    setSaving(false);
    setAddGroupOpen(false);
    showToast("Scheduling group created.");
    await load();
  }

  async function confirmDeleteGroup() {
    if (!deleteGroup) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 350));
    setSaving(false);
    setGroups((prev) => prev.filter((g) => g.id !== deleteGroup.id));
    // Detach the deleted group from any pages that referenced it
    setPages((prev) => prev.map((p) => (p.schedulingGroupId === deleteGroup.id ? { ...p, schedulingGroupId: undefined } : p)));
    setDeleteGroup(null);
    showToast("Scheduling group deleted.");
  }

  async function confirmDeletePage() {
    if (!deletePage) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 350));
    setSaving(false);
    setPages((prev) => prev.filter((p) => p.id !== deletePage.id));
    setDeletePage(null);
    showToast("Team booking page deleted.");
  }

  const pagesUsingGroup = deleteGroup
    ? pages.filter((p) => p.schedulingGroupId === deleteGroup.id)
    : [];

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "28px 28px 64px" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 12, color: "var(--fg-faint)", fontWeight: 500, marginBottom: 4 }}>
            Booking / Team booking pages
          </div>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 650, margin: 0, letterSpacing: "-0.02em" }}>
            Team booking pages
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: "6px 0 0", maxWidth: 560, lineHeight: 1.55 }}>
            Shared team pages and scheduling groups for round-robin booking. Customers book once;
            Transovo assigns the appointment to an available team member.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddPageOpen(true)}>
          <Plus size={15} /> New team page
        </button>
      </div>

      {state === "error" && <ErrorState onRetry={load} />}

      {state === "ready" && typesDegraded && (
        <div style={{ marginTop: 16 }}>
          <PartialNotice message="Booking types couldn't be fully loaded. Some options may be unavailable — your saved pages and groups are unchanged." />
        </div>
      )}

      {/* Scheduling groups */}
      {state !== "error" && (
        <section aria-labelledby="groups-heading" style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 id="groups-heading" style={{ fontSize: 16, fontWeight: 650, margin: 0 }}>Scheduling groups</h2>
              <p style={{ fontSize: 12.5, color: "var(--fg-muted)", margin: "3px 0 0" }}>
                Pools of team members that team pages distribute bookings across.
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setAddGroupOpen(true)}>
              <Plus size={14} /> Add group
            </button>
          </div>

          {state === "loading" ? (
            <SkeletonCards rows={2} />
          ) : groups.length === 0 ? (
            <EmptyState
              icon="group"
              title="No scheduling groups yet"
              body="Create a group of team members, then attach it to a team booking page so new bookings rotate across the group."
              action={
                <button className="btn btn-primary btn-sm" onClick={() => setAddGroupOpen(true)}>
                  <Plus size={14} /> Create scheduling group
                </button>
              }
            />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  staff={staffMembers}
                  onChange={(next) => setGroups((prev) => prev.map((x) => (x.id === g.id ? next : x)))}
                  onBlurSave={() => saveGroup(g)}
                  onToggleRoundRobin={() => {
                    const next = { ...g, roundRobinEnabled: !g.roundRobinEnabled };
                    setGroups((prev) => prev.map((x) => (x.id === g.id ? next : x)));
                    saveGroup(next);
                  }}
                  onToggleActive={() => {
                    const next = { ...g, active: g.active === false ? true : false };
                    setGroups((prev) => prev.map((x) => (x.id === g.id ? next : x)));
                    saveGroup(next);
                  }}
                  onDelete={() => setDeleteGroup(g)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Team pages */}
      {state !== "error" && (
        <section aria-labelledby="pages-heading" style={{ marginTop: 36 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 id="pages-heading" style={{ fontSize: 16, fontWeight: 650, margin: 0 }}>Team pages</h2>
              <p style={{ fontSize: 12.5, color: "var(--fg-muted)", margin: "3px 0 0" }}>
                Public booking URLs shared across your team.
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setAddPageOpen(true)}>
              <Plus size={14} /> Add page
            </button>
          </div>

          {state === "loading" ? (
            <SkeletonCards rows={2} />
          ) : pages.length === 0 ? (
            <EmptyState
              icon="page"
              title="No team booking pages yet"
              body="Create a team page to get a shareable link where customers can book with any available member of your team."
              action={
                <button className="btn btn-primary btn-sm" onClick={() => setAddPageOpen(true)}>
                  <Plus size={14} /> Create team booking page
                </button>
              }
            />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {pages.map((p) => (
                <PageCard
                  key={p.id}
                  page={p}
                  groups={groups}
                  types={types}
                  showUrl={workspaceSlug.length > 0}
                  onChange={(next) => setPages((prev) => prev.map((x) => (x.id === p.id ? next : x)))}
                  onBlurSave={() => savePage(p)}
                  onToggleActive={() => {
                    const next = { ...p, active: !p.active };
                    setPages((prev) => prev.map((x) => (x.id === p.id ? next : x)));
                    savePage(next);
                  }}
                  onDelete={() => setDeletePage(p)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <AddGroupModal open={addGroupOpen} saving={saving} onClose={() => setAddGroupOpen(false)} onCreate={createGroup} />
      <AddPageModal open={addPageOpen} saving={saving} groups={groups} types={types} onClose={() => setAddPageOpen(false)} onCreate={createPage} />

      <ConfirmDeleteModal
        open={!!deleteGroup}
        saving={saving}
        title={`Delete ${deleteGroup?.name ?? "group"}?`}
        body={
          <>
            This permanently removes the scheduling group.
            {pagesUsingGroup.length > 0
              ? ` ${pagesUsingGroup.length} team page${pagesUsingGroup.length === 1 ? "" : "s"} (${pagesUsingGroup.map((p) => p.name).join(", ")}) will keep working but switch to individual availability.`
              : " No team pages are attached to this group."}
          </>
        }
        confirmLabel="Delete group"
        onClose={() => setDeleteGroup(null)}
        onConfirm={confirmDeleteGroup}
      />
      <ConfirmDeleteModal
        open={!!deletePage}
        saving={saving}
        title={`Delete ${deletePage?.name ?? "team page"}?`}
        body={
          <>
            This permanently removes the team booking page and its public URL will stop accepting bookings.
            Existing appointments booked through this page are not affected.
          </>
        }
        confirmLabel="Delete page"
        onClose={() => setDeletePage(null)}
        onConfirm={confirmDeletePage}
      />

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
