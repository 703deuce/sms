"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useState } from "react";

type Snapshot = {
  provider: string;
  displayName: string;
  authKind: "oauth" | "credentials";
  status: string;
  syncStatus: string;
  accountId: string | null;
  accountName: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  lastWebhookAt: string | null;
  paused: boolean;
  counts: Record<string, number>;
  env?: { ready: boolean; missing: string[]; callbackUrl: string | null };
  secretsPresent: { accessToken: boolean; refreshToken: boolean };
};

type CatalogField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  help?: string;
};

export function NativeProviderClient({ provider }: { provider: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [help, setHelp] = useState<string>("");
  const [fields, setFields] = useState<CatalogField[]>([]);
  const [authKind, setAuthKind] = useState<"oauth" | "credentials">("credentials");
  const [displayName, setDisplayName] = useState(provider);
  const [form, setForm] = useState<Record<string, string>>({});
  const [prefs, setPrefs] = useState({
    enableReads: true,
    enableWrites: true,
    paused: false,
    webhooks: true,
    autoCreateContacts: true,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [acceptance, setAcceptance] = useState<unknown>(null);

  async function load() {
    const [diag, catalog] = await Promise.all([
      fetch(`/api/integrations/native?provider=${provider}&view=diagnostics`).then((r) =>
        r.json(),
      ),
      fetch("/api/integrations/native").then((r) => r.json()),
    ]);
    setSnapshot(diag.data || null);
    const entry = (catalog.data?.connections || []).find(
      (c: { id: string }) => c.id === provider,
    );
    if (entry) {
      setHelp(entry.credentialHelp || "");
      setFields(entry.credentialFields || []);
      setAuthKind(entry.authKind);
      setDisplayName(entry.displayName);
    }
    const settings = await fetch(
      `/api/integrations/native?provider=${provider}&view=settings`,
    ).then((r) => r.json());
    if (settings.data?.preferences) {
      setPrefs((p) => ({ ...p, ...settings.data.preferences }));
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setMessage({ text: "Connected successfully" });
  }, [provider]);

  async function post(action: string, body: Record<string, unknown> = {}) {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      if (action === "oauth_start") {
        window.location.href = json.data.redirectUrl;
        return;
      }
      if (action === "acceptance") setAcceptance(json.data);
      setMessage({ text: `${action} ok` });
      await load();
      return json.data;
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Failed", error: true });
    } finally {
      setBusy(null);
    }
  }

  const status = snapshot?.status || "disconnected";

  return (
    <div>
      <PageHeader
        title={displayName}
        description={
          authKind === "oauth"
            ? "App-level OAuth connection. Tokens are encrypted at rest and never shown again after storage."
            : "Customer-supplied credential connection (not OAuth). Secrets are encrypted at rest and never displayed after storage."
        }
      />

      <div className="mb-4">
        <Link href="/integrations/native" className="text-sm underline">
          ← All native integrations
        </Link>
      </div>

      {message ? (
        <p className={`mb-4 text-sm ${message.error ? "text-red-600" : "text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusChip
          status={
            status === "connected"
              ? "Connected"
              : status === "error"
                ? "Error"
                : status.replace(/_/g, " ")
          }
        />
        <span className="text-xs text-muted-foreground">
          sync: {snapshot?.syncStatus || "idle"}
        </span>
        {snapshot?.accountName ? (
          <span className="text-sm">Account: {snapshot.accountName}</span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Connection</CardTitle>
          {authKind === "oauth" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Callback URL:{" "}
                <code className="text-xs">{snapshot?.env?.callbackUrl}</code>
              </p>
              {snapshot?.env && !snapshot.env.ready ? (
                <p className="text-sm text-red-600">
                  Missing env: {(snapshot.env.missing || []).join(", ")}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy === "oauth_start"}
                  onClick={() => post("oauth_start")}
                >
                  {status === "connected" ? "Reconnect" : "Connect with OAuth"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy === "disconnect"}
                  onClick={() => post("disconnect")}
                >
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              {help ? <p className="text-sm text-muted-foreground">{help}</p> : null}
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    type={f.type === "password" ? "password" : "text"}
                    placeholder={f.placeholder}
                    value={form[f.key] || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    autoComplete="off"
                  />
                  {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy === "connect_credentials"}
                  onClick={() => post("connect_credentials", { credentials: form })}
                >
                  {status === "connected" ? "Validate & save" : "Connect"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === "rotate"}
                  onClick={() => post("rotate", { credentials: form })}
                >
                  Rotate credentials
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy === "disconnect"}
                  onClick={() => post("disconnect")}
                >
                  Disconnect
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Stored secrets are never returned.{" "}
                {snapshot?.secretsPresent.accessToken ? "A credential is on file." : "No credential stored."}
              </p>
            </>
          )}
        </Card>

        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Health & diagnostics</CardTitle>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Last sync: {snapshot?.lastSyncAt || "—"}</li>
            <li>Last webhook: {snapshot?.lastWebhookAt || "—"}</li>
            <li>Last error: {snapshot?.lastError || "—"}</li>
            <li>
              Mappings: {snapshot?.counts?.mappings ?? 0} · Pending jobs:{" "}
              {snapshot?.counts?.pendingJobs ?? 0} · Failed: {snapshot?.counts?.failedJobs ?? 0}
            </li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => post("probe", { probe: "validate" })}>
              Test connection
            </Button>
            <Button size="sm" variant="secondary" onClick={() => post("probe", { probe: "read" })}>
              Read probe
            </Button>
            <Button size="sm" variant="secondary" onClick={() => post("probe", { probe: "write" })}>
              Write probe
            </Button>
            <Button size="sm" onClick={() => post("sync")}>
              Force sync
            </Button>
            <Button size="sm" variant="outline" onClick={() => post("acceptance")}>
              Run acceptance
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-4 lg:col-span-2">
          <CardTitle className="text-base">Settings</CardTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["enableReads", "Enable reads"],
                ["enableWrites", "Enable writes"],
                ["webhooks", "Webhooks"],
                ["autoCreateContacts", "Auto-create Transovo contacts"],
                ["paused", "Pause connection"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(prefs[key])}
                  onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <Button
            size="sm"
            disabled={busy === "save_settings"}
            onClick={() => post("save_settings", { preferences: prefs })}
          >
            Save settings
          </Button>
        </Card>
      </div>

      {acceptance ? (
        <Card className="mt-4 p-4">
          <CardTitle className="mb-2 text-base">Acceptance results</CardTitle>
          <pre className="max-h-96 overflow-auto text-xs">
            {JSON.stringify(acceptance, null, 2)}
          </pre>
        </Card>
      ) : null}
    </div>
  );
}
