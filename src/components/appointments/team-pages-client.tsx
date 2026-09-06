"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { SchedulingGroup, TeamBookingPage } from "@/lib/appointments/scheduling-capabilities";
import { Plus, ExternalLink } from "lucide-react";

export function TeamPagesClient({ workspaceSlug }: { workspaceSlug: string }) {
  const [groups, setGroups] = useState<SchedulingGroup[]>([]);
  const [pages, setPages] = useState<TeamBookingPage[]>([]);
  const [types, setTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [teamRes, typesRes] = await Promise.all([
      fetch("/api/appointments/team-pages"),
      fetch("/api/appointments/types"),
    ]);
    if (teamRes.ok) {
      const json = await teamRes.json();
      // load groups separately
      const groupsRes = await fetch("/api/appointments/team-pages?kind=groups");
      const groupsJson = groupsRes.ok ? await groupsRes.json() : { data: [] };
      setPages(json.data || []);
      setGroups(groupsJson.data || []);
    }
    if (typesRes.ok) {
      const json = await typesRes.json();
      setTypes((json.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function savePage(page: TeamBookingPage) {
    setSaving(true);
    await fetch("/api/appointments/team-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: page }),
    });
    setSaving(false);
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
    await load();
  }

  function newPage(): TeamBookingPage {
    return {
      id: `tp_${Date.now()}`,
      name: "Team booking page",
      slug: "team",
      appointmentTypeIds: types[0] ? [types[0].id] : [],
      active: true,
    };
  }

  function newGroup(): SchedulingGroup {
    return {
      id: `sg_${Date.now()}`,
      name: "Scheduling group",
      slug: "group",
      memberStaffIds: [],
      roundRobinEnabled: true,
      active: true,
    };
  }

  return (
    <div className="px-6 py-6 lg:px-8 max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Team booking pages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Shared team pages and scheduling groups for round-robin booking.
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Scheduling groups</h2>
          <Button size="sm" variant="outline" onClick={() => saveGroup(newGroup())}>
            <Plus className="h-4 w-4" /> Add group
          </Button>
        </div>
        <div className="space-y-3">
          {groups.map((g) => (
            <Card key={g.id} className="p-4">
              <Input
                value={g.name}
                onChange={(e) => {
                  const next = groups.map((x) => (x.id === g.id ? { ...g, name: e.target.value } : x));
                  setGroups(next);
                }}
                onBlur={() => saveGroup(g)}
              />
              <p className="text-[12px] text-muted-foreground mt-1">
                {g.memberStaffIds.length} members · Round-robin {g.roundRobinEnabled ? "on" : "off"}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Team pages</h2>
          <Button size="sm" onClick={() => savePage(newPage())}>
            <Plus className="h-4 w-4" /> Add page
          </Button>
        </div>
        <div className="space-y-3">
          {pages.map((p) => {
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/team/${workspaceSlug}/${p.slug}`;
            return (
              <Card key={p.id} className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Page name</Label>
                    <Input
                      value={p.name}
                      onChange={(e) => {
                        setPages(pages.map((x) => (x.id === p.id ? { ...p, name: e.target.value } : x)));
                      }}
                      onBlur={() => savePage(p)}
                    />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input
                      value={p.slug}
                      onChange={(e) => {
                        setPages(pages.map((x) => (x.id === p.id ? { ...p, slug: e.target.value } : x)));
                      }}
                      onBlur={() => savePage(p)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> {url}
                    </a>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
