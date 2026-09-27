"use client";

import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { Checkbox } from "@/newui-transplant/components/ui/checkbox";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
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
  calendly?: {
    callbackUrl?: string | null;
    webhookUrl?: string | null;
    webhookSigningKeyPresent?: boolean;
    webhookSigningKeyFromConfig?: boolean;
    webhookSubscriptionSigningKeyCaptured?: boolean;
    webhookSigningKeySource?: string | null;
    webhookSigningKeyMismatchRisk?: boolean;
    webhookSigningKeyEnv?: Record<string, boolean>;
    webhookSigningKeyEnvNames?: string[];
    calendlyEnvNamesPresent?: string[];
    clientIdPresent?: boolean;
    clientSecretPresent?: boolean;
    userUri?: string | null;
    organizationUri?: string | null;
    timezone?: string | null;
    webhookSubscriptionIds?: string[];
    webhookSetupError?: string | null;
    webhooksPlanBlocked?: boolean;
    scopesRequested?: string[];
    webhookSubscriptionsLive?: Array<{
      uri?: string;
      callbackUrl?: string | null;
      state?: string | null;
      scope?: string | null;
      events?: string[];
      retryStartedAt?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;
    webhookDeliveryFailing?: boolean;
    webhookSilentDeliveryRisk?: boolean;
    webhookActiveCount?: number;
    webhookSubscriptionsLiveError?: string;
    webhookSigningKeyFingerprint?: string | null;
    webhookSubscriptionScope?: string | null;
    lastWebhookHitAt?: string | null;
    lastWebhookHitStatus?: number | null;
    lastWebhookHitReason?: string | null;
    webhookHitCount?: number;
  };
};

type CatalogField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  help?: string;
};

export function NativeProviderOpus({ provider }: { provider: string }) {
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
    <div className="space-y-4">
      <Panel
        title={displayName}
        description={
          authKind === "oauth"
            ? "App-level OAuth connection. Tokens are encrypted at rest and never shown again after storage."
            : "Customer-supplied credential connection (not OAuth). Secrets are encrypted at rest and never displayed after storage."
        }
      />

      <div className="mb-4">
        <ButtonLink href="/integrations/native" variant="outline">
          ← All native integrations
        </ButtonLink>
      </div>

      {message ? (
        <p className={`mb-4 text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Pill tone={status === "connected" ? "success" : status === "error" ? "danger" : "neutral"}>{status === "connected" ? "Connected" : status === "error" ? "Error" : status.replace(/_/g, " ")}</Pill>
        <span className="text-xs text-muted-foreground">
          sync: {snapshot?.syncStatus || "idle"}
        </span>
        {snapshot?.accountName ? (
          <span className="text-sm">Account: {snapshot.accountName}</span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <p className="text-base font-semibold">Connection</p>
          {authKind === "oauth" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Callback URL:{" "}
                <code className="text-xs">{snapshot?.env?.callbackUrl}</code>
              </p>
              {snapshot?.env && !snapshot.env.ready ? (
                <p className="text-sm text-destructive">
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
                  variant="destructive"
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
                  variant="outline"
                  disabled={busy === "rotate"}
                  onClick={() => post("rotate", { credentials: form })}
                >
                  Rotate credentials
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
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
        </Panel>

        <Panel>
          <p className="text-base font-semibold">Health & diagnostics</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Env ready: {snapshot?.env?.ready ? "yes" : "no"}</li>
            <li>Last sync: {snapshot?.lastSyncAt || "—"}</li>
            <li>Last webhook accepted: {snapshot?.lastWebhookAt || "—"}</li>
            {snapshot?.calendly ? (
              <li>
                Last webhook hit: {snapshot.calendly.lastWebhookHitAt || "—"}
                {snapshot.calendly.lastWebhookHitStatus != null
                  ? ` · HTTP ${snapshot.calendly.lastWebhookHitStatus}`
                  : ""}
                {snapshot.calendly.lastWebhookHitReason
                  ? ` · ${snapshot.calendly.lastWebhookHitReason}`
                  : ""}
                {snapshot.calendly.webhookHitCount
                  ? ` · hits=${snapshot.calendly.webhookHitCount}`
                  : ""}
              </li>
            ) : null}
            <li>Last error: {snapshot?.lastError || "—"}</li>
            <li>
              Tokens: access {snapshot?.secretsPresent?.accessToken ? "yes" : "no"} · refresh{" "}
              {snapshot?.secretsPresent?.refreshToken ? "yes" : "no"}
            </li>
            <li>
              Mappings: {snapshot?.counts?.mappings ?? 0} · Pending jobs:{" "}
              {snapshot?.counts?.pendingJobs ?? 0} · Failed: {snapshot?.counts?.failedJobs ?? 0}
            </li>
          </ul>
          {snapshot?.calendly ? (
            <ul className="space-y-1 border-t pt-2 text-sm text-muted-foreground">
              <li>
                Webhook signing key:{" "}
                {snapshot.calendly.webhookSubscriptionSigningKeyCaptured
                  ? "captured from Calendly subscription"
                  : snapshot.calendly.webhookSigningKeyPresent
                    ? "present (OAuth app / Coolify env)"
                    : "missing"}
                {snapshot.calendly.webhookSigningKeyMismatchRisk ? (
                  <span className="block text-xs text-amber-700">
                    Subscription exists but no signing key is available to verify
                    deliveries. For OAuth apps, paste the <strong>Webhook signing key</strong>{" "}
                    from the Calendly developer portal (shown once when the OAuth app was
                    created) into Coolify as <code>CALENDLY_WEBHOOK_SIGNING_KEY</code>, then
                    redeploy.
                  </span>
                ) : null}
                {!snapshot.calendly.webhookSigningKeyPresent &&
                !snapshot.calendly.webhookSigningKeyMismatchRisk ? (
                  <span className="block text-xs text-amber-700">
                    Set <code>CALENDLY_WEBHOOK_SIGNING_KEY</code> in Coolify to the OAuth
                    app&apos;s webhook signing key from the Calendly developer portal, then
                    redeploy. Click <strong>Register webhooks</strong> if no subscription
                    exists yet.
                  </span>
                ) : null}
                {snapshot.calendly.webhookSigningKeyEnv ? (
                  <span className="block text-xs">
                    Env:{" "}
                    {Object.entries(snapshot.calendly.webhookSigningKeyEnv)
                      .map(([k, v]) => `${k}=${v ? "yes" : "no"}`)
                      .join(" · ")}
                    {snapshot.calendly.webhookSigningKeyFromConfig
                      ? " · stored on connection=yes"
                      : ""}
                    {snapshot.calendly.webhookSigningKeySource
                      ? ` · source=${snapshot.calendly.webhookSigningKeySource}`
                      : ""}
                  </span>
                ) : null}
                <span className="block text-xs">
                  CALENDLY_* vars visible to app:{" "}
                  {(snapshot.calendly.calendlyEnvNamesPresent || []).length
                    ? snapshot.calendly.calendlyEnvNamesPresent!.join(", ")
                    : "(none)"}
                  {" · "}
                  client id={snapshot.calendly.clientIdPresent ? "yes" : "no"} · secret=
                  {snapshot.calendly.clientSecretPresent ? "yes" : "no"}
                </span>
              </li>
              <li className="break-all">
                Webhook URL: <code className="text-xs">{snapshot.calendly.webhookUrl}</code>
              </li>
              <li className="break-all">User URI: {snapshot.calendly.userUri || "—"}</li>
              <li className="break-all">
                Organization URI: {snapshot.calendly.organizationUri || "—"}
              </li>
              <li>
                Webhook subscription:{" "}
                {snapshot.calendly.webhookActiveCount != null
                  ? `${snapshot.calendly.webhookActiveCount} active`
                  : (snapshot.calendly.webhookSubscriptionIds || []).length
                    ? "present"
                    : snapshot.calendly.webhooksPlanBlocked
                      ? "blocked by Calendly plan (Free)"
                      : "none"}
              </li>
              {snapshot.calendly.webhookSigningKeyFingerprint ? (
                <li className="text-xs">
                  Signing key fingerprint:{" "}
                  <code>{snapshot.calendly.webhookSigningKeyFingerprint}</code>{" "}
                  (sha256 prefix — confirm Coolify key matches the portal)
                </li>
              ) : null}
              {snapshot.calendly.webhookSubscriptionScope ? (
                <li className="text-xs">
                  Registered scope: {snapshot.calendly.webhookSubscriptionScope}
                </li>
              ) : null}
              {snapshot.calendly.webhookDeliveryFailing ? (
                <li className="text-amber-700">
                  Calendly is <strong>retrying deliveries</strong> (
                  <code>retry_started_at</code> set). That almost always means our
                  endpoint returned <strong>401 Invalid signature</strong> — Coolify{" "}
                  <code>CALENDLY_WEBHOOK_SIGNING_KEY</code> must match the{" "}
                  <strong>Webhook signing key</strong> shown once when you created the
                  OAuth app in the Calendly developer portal (not a random string).
                </li>
              ) : null}
              {snapshot.calendly.webhookSilentDeliveryRisk ? (
                <li className="text-amber-700">
                  Subscription is active, but Transovo has never seen an inbound hit
                  from Calendly (no accepted webhook and no failed signature attempt).
                  Book/cancel can still work via API. Re-run{" "}
                  <strong>Register webhooks</strong> (now prefers organization scope),
                  then cancel a meeting and check whether &quot;Last webhook hit&quot;
                  updates.
                </li>
              ) : null}
              {(snapshot.calendly.webhookSubscriptionsLive || []).length ? (
                <li className="text-xs break-all">
                  Live subs:{" "}
                  {snapshot.calendly.webhookSubscriptionsLive!.map((s) => (
                    <span key={s.uri} className="block">
                      {s.state || "?"} · scope={s.scope || "?"} · retry=
                      {s.retryStartedAt || "none"} ·{" "}
                      {(s.events || []).join(",") || "events?"}
                    </span>
                  ))}
                </li>
              ) : null}
              {snapshot.calendly.webhookSetupError ? (
                <li className="text-amber-700">{snapshot.calendly.webhookSetupError}</li>
              ) : null}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => post("probe", { probe: "validate" })}>
              Test connection
            </Button>
            <Button size="sm" variant="outline" onClick={() => post("probe", { probe: "identify" })}>
              Fetch identity
            </Button>
            <Button size="sm" variant="outline" onClick={() => post("probe", { probe: "read" })}>
              Read probe
            </Button>
            <Button size="sm" variant="outline" onClick={() => post("probe", { probe: "write" })}>
              Write probe
            </Button>
            {provider === "calendly" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => post("probe", { probe: "register_webhooks" })}
                >
                  Register webhooks
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => post("probe", { probe: "webhook_self_test" })}
                >
                  Webhook self-test
                </Button>
              </>
            ) : null}
            <Button size="sm" onClick={() => post("sync")}>
              Force sync
            </Button>
            <Button size="sm" variant="outline" onClick={() => post("acceptance")}>
              Run acceptance
            </Button>
          </div>
        </Panel>

        <Panel>
          <p className="text-base font-semibold">Settings</p>
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
                <Checkbox
                  checked={Boolean(prefs[key])}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: Boolean(v) }))}
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
        </Panel>
      </div>

      {acceptance ? (
        <Panel>
          <p className="mb-2 text-base font-semibold">Acceptance results</p>
          <pre className="max-h-96 overflow-auto text-xs">
            {JSON.stringify(acceptance, null, 2)}
          </pre>
        </Panel>
      ) : null}
    </div>
  );
}
