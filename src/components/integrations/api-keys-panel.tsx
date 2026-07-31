"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Key, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type Props = {
  initialKeys: ApiKeyRow[];
};

export function ApiKeysPanel({ initialKeys }: Props) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch("/api/keys");
    if (!res.ok) return;
    const json = await res.json();
    setKeys(
      (json.data || []).map((k: ApiKeyRow) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      })),
    );
  }

  async function createKey() {
    if (!keyName.trim()) return;
    setCreating(true);
    setError("");
    setNewKey(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create key");
      setNewKey(json.data?.key || null);
      setKeyName("");
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) return;
    await refresh();
    router.refresh();
  }

  return (
    <>
      <Card className="mb-4">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-primary" />
          <CardTitle>Active keys</CardTitle>
        </div>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API keys yet. Create one below.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Key</TH>
                <TH>Created</TH>
                <TH>Last used</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {keys.map((key) => (
                <TR key={key.id}>
                  <TD className="font-medium">{key.name}</TD>
                  <TD className="font-mono text-sm text-muted-foreground">
                    {key.prefix}••••
                  </TD>
                  <TD className="text-muted-foreground">
                    {new Date(key.createdAt).toLocaleDateString()}
                  </TD>
                  <TD className="text-muted-foreground">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                  </TD>
                  <TD>
                    <StatusChip status="Active" />
                  </TD>
                  <TD className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => revoke(key.id)}>
                      Revoke
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Create API key</CardTitle>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="keyName">Key name</Label>
              <Input
                id="keyName"
                placeholder="e.g. CRM sync"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {newKey ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Copy your key now — it won&apos;t be shown again.</p>
                <code className="mt-2 block break-all font-mono text-xs">{newKey}</code>
              </div>
            ) : null}
            <Button type="button" onClick={createKey} disabled={creating || !keyName.trim()}>
              <Plus className="h-4 w-4" />
              {creating ? "Generating…" : "Generate key"}
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>API documentation</CardTitle>
          <p className="mt-3 text-sm text-muted-foreground">
            Use the REST API to create contacts, send campaigns, and retrieve message status.
            Authenticate with your API key in the Authorization header.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-medium">Base URL:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">https://api.transovo.com/v1</code>
            </p>
            <p>
              <span className="font-medium">Rate limit:</span> 100 requests/minute per key
            </p>
          </div>
          <Link
            href="/integrations/logs"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            View developer logs →
          </Link>
        </Card>
      </div>
    </>
  );
}
