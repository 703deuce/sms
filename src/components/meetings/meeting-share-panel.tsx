"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Check, Copy, Link2, Share2, X } from "lucide-react";
import { useState } from "react";

type ShareResult = {
  token: string;
  publicUrl: string;
};

type Props = {
  meetingId: string;
  onClose?: () => void;
};

export function MeetingSharePanel({ meetingId, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeActionItems, setIncludeActionItems] = useState(true);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [includeRecording, setIncludeRecording] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function createShareLink() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "share",
          includeSummary,
          includeActionItems,
          includeTranscript,
          includeRecording,
          password: password.trim() || null,
          expiresInDays: expiresInDays.trim() ? Number(expiresInDays) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create share link");
      setResult({
        token: json.data.token,
        publicUrl: json.data.publicUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!result?.publicUrl) return;
    await navigator.clipboard.writeText(result.publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="mr-2 h-4 w-4" />
        Share recap
      </Button>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Share recap</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a link anyone can open to view selected recap content.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {result ? (
        <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">Share link created</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs text-emerald-900">
              {result.publicUrl}
            </code>
            <Button size="sm" variant="outline" onClick={() => void copyLink()}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
            Create another link
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeSummary}
                onChange={(e) => setIncludeSummary(e.target.checked)}
              />
              Summary
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeActionItems}
                onChange={(e) => setIncludeActionItems(e.target.checked)}
              />
              Action items
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeTranscript}
                onChange={(e) => setIncludeTranscript(e.target.checked)}
              />
              Transcript
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeRecording}
                onChange={(e) => setIncludeRecording(e.target.checked)}
              />
              Recording
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="share-password">Password (optional)</Label>
              <Input
                id="share-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for open access"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="share-expires">Expires in days (optional)</Label>
              <Input
                id="share-expires"
                type="number"
                min={1}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="Never"
                className="mt-1.5"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button disabled={busy} onClick={() => void createShareLink()}>
            <Link2 className="mr-2 h-4 w-4" />
            {busy ? "Creating link…" : "Create share link"}
          </Button>
        </>
      )}
    </Card>
  );
}
