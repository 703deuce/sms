"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function EnterpriseSchedulingClient() {
  const [data, setData] = useState<{
    samlSso: { enabled?: boolean; entityId?: string; ssoUrl?: string; certificate?: string };
    scimProvisioning: { enabled?: boolean; bearerToken?: string; defaultRoleId?: string };
    organizationPolicy: { managedEventTypesOnly?: boolean; managedAutomationsOnly?: boolean };
    roles: Array<{ id: string; name: string }>;
    userRoleAssignments: Record<string, string>;
    workspaceId?: string;
  } | null>(null);
  const [roleDraft, setRoleDraft] = useState<{ email: string; roleId: string }>({ email: "", roleId: "scheduler" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/appointments/org");
    if (res.ok) {
      const json = await res.json();
      setData({
        ...json.data,
        userRoleAssignments: json.data.userRoleAssignments || {},
        organizationPolicy: json.data.organizationPolicy || {},
        samlSso: json.data.samlSso || {},
        scimProvisioning: json.data.scimProvisioning || {},
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSaml() {
    if (!data) return;
    setSaving(true);
    await fetch("/api/appointments/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saml", config: data.samlSso }),
    });
    setSaving(false);
  }

  async function saveScim() {
    if (!data) return;
    setSaving(true);
    await fetch("/api/appointments/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scim", config: data.scimProvisioning }),
    });
    setSaving(false);
  }

  async function saveRoles() {
    if (!data) return;
    setSaving(true);
    await fetch("/api/appointments/org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "roles", assignments: data.userRoleAssignments }),
    });
    setSaving(false);
  }

  function addRoleAssignment() {
    if (!data || !roleDraft.email.trim()) return;
    setData({
      ...data,
      userRoleAssignments: {
        ...(data.userRoleAssignments || {}),
        [roleDraft.email.trim().toLowerCase()]: roleDraft.roleId,
      },
    });
    setRoleDraft({ email: "", roleId: roleDraft.roleId });
  }

  async function savePolicy() {
    if (!data) return;
    setSaving(true);
    await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationPolicy: data.organizationPolicy }),
    });
    setSaving(false);
  }

  if (!data) return <div className="p-8 animate-pulse">Loading…</div>;

  return (
    <div className="px-6 py-6 lg:px-8 max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">Organization & enterprise</h1>

      <Card className="p-5 space-y-4">
        <CardTitle>Scheduling policy</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.organizationPolicy?.managedEventTypesOnly || false}
            onChange={(e) =>
              setData({
                ...data,
                organizationPolicy: { ...data.organizationPolicy, managedEventTypesOnly: e.target.checked },
              })
            }
          />
          Managed event types only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.organizationPolicy?.managedAutomationsOnly || false}
            onChange={(e) =>
              setData({
                ...data,
                organizationPolicy: { ...data.organizationPolicy, managedAutomationsOnly: e.target.checked },
              })
            }
          />
          Managed automations only
        </label>
        <Button size="sm" onClick={savePolicy} disabled={saving}>Save policy</Button>
      </Card>

      <Card className="p-5 space-y-4">
        <CardTitle>SAML SSO</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.samlSso?.enabled || false}
            onChange={(e) => setData({ ...data, samlSso: { ...data.samlSso, enabled: e.target.checked } })}
          />
          Enable SAML SSO
        </label>
        <div><Label>Entity ID</Label><Input value={data.samlSso?.entityId || ""} onChange={(e) => setData({ ...data, samlSso: { ...data.samlSso, entityId: e.target.value } })} /></div>
        <div><Label>SSO URL</Label><Input value={data.samlSso?.ssoUrl || ""} onChange={(e) => setData({ ...data, samlSso: { ...data.samlSso, ssoUrl: e.target.value } })} /></div>
        <div>
          <Label>IdP certificate (PEM)</Label>
          <textarea
            className="mt-1.5 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            value={data.samlSso?.certificate || ""}
            onChange={(e) => setData({ ...data, samlSso: { ...data.samlSso, certificate: e.target.value } })}
            placeholder="-----BEGIN CERTIFICATE-----"
          />
        </div>
        <Button size="sm" onClick={saveSaml} disabled={saving}>Save SAML</Button>
      </Card>

      <Card className="p-5 space-y-4">
        <CardTitle>SCIM provisioning</CardTitle>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.scimProvisioning?.enabled || false}
            onChange={(e) => setData({ ...data, scimProvisioning: { ...data.scimProvisioning, enabled: e.target.checked } })}
          />
          Enable SCIM
        </label>
        <Button size="sm" onClick={saveScim} disabled={saving}>Save SCIM</Button>
      </Card>

      <Card className="p-5">
        <CardTitle className="mb-3">Granular roles & assignments</CardTitle>
        <ul className="mb-4 space-y-2 text-sm">
          {data.roles.map((r) => (
            <li key={r.id} className="rounded border px-3 py-2">{r.name}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 mb-3">
          <Input
            placeholder="user@company.com"
            value={roleDraft.email}
            onChange={(e) => setRoleDraft({ ...roleDraft, email: e.target.value })}
            className="max-w-xs"
          />
          <select
            className="rounded border px-2 py-1 text-sm"
            value={roleDraft.roleId}
            onChange={(e) => setRoleDraft({ ...roleDraft, roleId: e.target.value })}
          >
            {data.roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={addRoleAssignment}>Assign</Button>
        </div>
        {Object.entries(data.userRoleAssignments || {}).length ? (
          <ul className="space-y-1 text-sm mb-3">
            {Object.entries(data.userRoleAssignments || {}).map(([email, roleId]) => (
              <li key={email} className="flex items-center justify-between rounded border px-3 py-2">
                <span>{email}</span>
                <span className="text-muted-foreground">{data.roles.find((r) => r.id === roleId)?.name || roleId}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground mb-3">No user role assignments yet.</p>
        )}
        <Button size="sm" onClick={saveRoles} disabled={saving}>Save assignments</Button>
      </Card>
    </div>
  );
}
