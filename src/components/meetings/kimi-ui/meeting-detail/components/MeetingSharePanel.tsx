"use client";

import { useState } from "react";
import { Check, Copy, Link2, Share2, Trash2, X } from "lucide-react";
import { Button, Card, Input, Label, StatusChip } from "./ui";
import type { ShareLink } from "../types";

type Props = {
  meetingId: string;
  initialShares: ShareLink[];
  onClose?: () => void;
};

export function MeetingSharePanel({ meetingId, initialShares, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeActionItems, setIncludeActionItems] = useState(true);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [includeRecording, setIncludeRecording] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ token: string; publicUrl: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareLink[]>(initialShares);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  async function createShareLink() {
    setBusy(true);
    setError("");
    setCopiedId(null);
    // Sandbox: simulate PATCH /api/meetings/${meetingId} { action: "share" }
    await new Promise((r) => setTimeout(r, 650));
    const token = Math.random().toString(36).slice(2, 8);
    const publicUrl = `https://app.transovo.com/recap/${meetingId.slice(-6)}-${token}`;
    setResult({ token, publicUrl });
    setShares((s) => [
      {
        id: `shr_${Date.now()}`,
        publicUrl,
        expiresAt: expiresInDays.trim()
          ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString()
          : null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        status: "active",
      },
      ...s,
    ]);
    setBusy(false);
  }

  async function copyLink(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard unavailable in sandbox */
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  }

  async function revokeShare(shareId: string) {
    setBusy(true);
    setError("");
    // Sandbox: simulate PATCH { action: "revoke_share", shareId }
    await new Promise((r) => setTimeout(r, 450));
    setShares((s) =>
      s.map((sh) =>
        sh.id === shareId ? { ...sh, status: "revoked", revokedAt: new Date().toISOString() } : sh,
      ),
    );
    setConfirmRevokeId(null);
    setBusy(false);
  }

  function shareStatusLabel(share: ShareLink) {
    if (share.status === "revoked") return "Revoked";
    if (share.status === "expired") return "Expired";
    if (share.expiresAt) return `Active · expires ${new Date(share.expiresAt).toLocaleDateString()}`;
    return "Active";
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="h-3.5 w-3.5" />
        Share recap
      </Button>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight">Share recap</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Create a link anyone can open to view selected recap content.
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Close share panel"
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {shares.length ? (
        <div className="space-y-2.5">
          <h3 className="text-[13px] font-semibold">Share links</h3>
          <ul className="space-y-2">
            {shares.map((share) => (
              <li key={share.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusChip
                        tone={
                          share.status === "active" ? "success" : share.status === "expired" ? "warning" : "neutral"
                        }
                      >
                        {shareStatusLabel(share)}
                      </StatusChip>
                    </div>
                    <code className="mt-1.5 block break-all rounded bg-muted px-2 py-1 text-[11px] text-foreground/80">
                      {share.publicUrl}
                    </code>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Created {new Date(share.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => void copyLink(share.publicUrl, share.id)}>
                      {copiedId === share.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedId === share.id ? "Copied" : "Copy"}
                    </Button>
                    {share.status === "active" && confirmRevokeId !== share.id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        className="text-[hsl(0_72%_44%)] hover:bg-[hsl(0_72%_51%/0.06)]"
                        onClick={() => setConfirmRevokeId(share.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                </div>
                {confirmRevokeId === share.id ? (
                  <div
                    className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(0_72%_51%/0.25)] bg-[hsl(0_72%_51%/0.05)] p-2.5"
                    role="alert"
                  >
                    <p className="min-w-0 flex-1 text-[12px] text-foreground">
                      Revoke this link? Anyone with it will immediately lose access to the recap.
                    </p>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void revokeShare(share.id)}
                      >
                        {busy ? "Revoking…" : "Yes, revoke"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setConfirmRevokeId(null)}
                      >
                        Keep link
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-[hsl(152_56%_36%/0.3)] bg-[hsl(152_56%_36%/0.06)] p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[hsl(152_56%_30%)]">
            <Link2 className="h-3.5 w-3.5" /> Share link created
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-card px-2 py-1.5 text-[11px]">
              {result.publicUrl}
            </code>
            <Button size="sm" variant="outline" onClick={() => void copyLink(result.publicUrl, "new")}>
              {copiedId === "new" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedId === "new" ? "Copied" : "Copy"}
            </Button>
          </div>
          <button
            className="mt-2 text-[12px] font-medium text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => setResult(null)}
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-3.5">
          <h3 className="text-[13px] font-semibold">New share link</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {[
              ["Summary", includeSummary, setIncludeSummary],
              ["Action items", includeActionItems, setIncludeActionItems],
              ["Transcript", includeTranscript, setIncludeTranscript],
              ["Recording", includeRecording, setIncludeRecording],
            ].map(([label, value, setter]) => (
              <label key={label as string} className="flex items-center gap-2 text-[13px] text-foreground/90">
                <input
                  type="checkbox"
                  checked={value as boolean}
                  onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-[hsl(234_62%_54%)]"
                />
                {label as string}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="share-password">Password — optional</Label>
              <Input
                id="share-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Require a password"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="share-expiry">Expires in — days, optional</Label>
              <Input
                id="share-expiry"
                type="number"
                min={1}
                inputMode="numeric"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="Never expires"
              />
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-[13px] font-medium text-[hsl(0_72%_44%)]">
              {error}
            </p>
          ) : null}
          <div>
            <Button size="sm" disabled={busy || (!includeSummary && !includeActionItems && !includeTranscript && !includeRecording)} onClick={() => void createShareLink()}>
              {busy ? "Creating…" : "Create share link"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
