"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState, Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/newui-transplant/components/ui/table";
import { Key, Plus } from "lucide-react";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function ApiKeysOpusPanel({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
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
    <div className="space-y-6">
      <Panel title="Active keys" description="Programmatic access to contacts, campaigns, and messages.">
        {keys.length === 0 ? (
          <EmptyState
            icon={Key}
            title="No API keys"
            description="Create a key below to authenticate REST requests."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{key.prefix}••••</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell><Pill tone="success">Active</Pill></TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => void revoke(key.id)}>Revoke</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Create API key">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="keyName">Key name</Label>
              <Input id="keyName" placeholder="e.g. CRM sync" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {newKey ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Copy your key now — it won&apos;t be shown again.</p>
                <code className="mt-2 block break-all font-mono text-xs">{newKey}</code>
              </div>
            ) : null}
            <Button type="button" onClick={() => void createKey()} disabled={creating || !keyName.trim()}>
              <Plus className="mr-2 size-4" aria-hidden />
              {creating ? "Generating…" : "Generate key"}
            </Button>
          </div>
        </Panel>

        <Panel title="API documentation">
          <p className="text-sm text-muted-foreground">
            Authenticate with your API key in the Authorization header.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <p>
              <span className="font-medium">Base URL:</span>{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">https://api.transovo.com/v1</code>
            </p>
            <p><span className="font-medium">Rate limit:</span> 100 requests/minute per key</p>
          </div>
          <Link href="/integrations/logs" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            View developer logs →
          </Link>
        </Panel>
      </div>
    </div>
  );
}
