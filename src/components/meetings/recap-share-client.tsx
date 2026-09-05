"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type RecapMeta = {
  token: string;
  title: string | null;
  scheduledStartAt: string | null;
  businessName: string;
  passwordRequired: boolean;
  includeSummary: boolean;
  includeActionItems: boolean;
  includeTranscript: boolean;
  includeRecording: boolean;
};

type RecapView = RecapMeta & {
  summaryText?: string | null;
  actionItems?: Array<{ id: string; description: string; assigneeText: string | null; completed: boolean }>;
  transcriptSegments?: Array<{ id: string; speakerName: string | null; text: string; startMs: number | null }>;
  recordingUrl?: string | null;
  recordingTemporary?: boolean;
};

export function RecapShareClient({ token }: { token: string }) {
  const [meta, setMeta] = useState<RecapMeta | null>(null);
  const [recap, setRecap] = useState<RecapView | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/recap/${token}`);
        const json = await res.json();
        if (!active) return;
        if (!json.data) {
          setError(json.error || "This recap link is invalid or unavailable.");
          return;
        }
        setMeta(json.data);
        if (!json.data.passwordRequired) {
          const unlockRes = await fetch(`/api/recap/${token}/unlock`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          const unlockJson = await unlockRes.json();
          if (!active) return;
          if (!unlockRes.ok) {
            setError(unlockJson.error || "Unable to load recap.");
            return;
          }
          setRecap(unlockJson.data);
        }
      } catch {
        if (active) setError("Unable to load recap.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function loadRecap(unlockPassword?: string) {
    setUnlocking(true);
    setError("");
    const res = await fetch(`/api/recap/${token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: unlockPassword || undefined }),
    });
    const json = await res.json();
    setUnlocking(false);
    if (!res.ok) {
      setError(json.error || "Unable to unlock recap.");
      return;
    }
    setRecap(json.data);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !meta) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (meta && meta.passwordRequired && !recap) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{meta.businessName}</p>
          <h1 className="mt-1 text-2xl font-semibold">{meta.title || "Meeting recap"}</h1>
        </div>
        <Card className="space-y-4 p-5">
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter recap password"
            />
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button className="w-full" disabled={unlocking || !password.trim()} onClick={() => void loadRecap(password)}>
            {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : "View recap"}
          </Button>
        </Card>
      </div>
    );
  }

  const view = recap || meta;
  if (!view) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Recap unavailable.
      </div>
    );
  }

  const scheduled = view.scheduledStartAt
    ? new Date(view.scheduledStartAt).toLocaleString()
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <p className="text-sm text-muted-foreground">{view.businessName}</p>
        <h1 className="mt-1 text-2xl font-semibold">{view.title || "Meeting recap"}</h1>
        {scheduled ? <p className="mt-1 text-sm text-muted-foreground">{scheduled}</p> : null}
      </div>

      {recap?.includeSummary ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Summary</h2>
          <p className="whitespace-pre-wrap text-sm">{recap.summaryText || "No summary available."}</p>
        </Card>
      ) : null}

      {recap?.includeActionItems ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Action items</h2>
          {recap.actionItems?.length ? (
            <ul className="space-y-2 text-sm">
              {recap.actionItems.map((item) => (
                <li key={item.id}>
                  {item.completed ? "✓ " : "• "}
                  {item.description}
                  {item.assigneeText ? ` — ${item.assigneeText}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No action items shared.</p>
          )}
        </Card>
      ) : null}

      {recap?.includeRecording && recap.recordingUrl ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Recording</h2>
          {recap.recordingTemporary ? (
            <p className="text-xs text-amber-700">Temporary recording link — may expire.</p>
          ) : null}
          <video src={recap.recordingUrl} controls className="w-full rounded-lg bg-black" />
        </Card>
      ) : null}

      {recap?.includeTranscript ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Transcript</h2>
          <div className="max-h-96 space-y-3 overflow-y-auto text-sm">
            {recap.transcriptSegments?.length ? (
              recap.transcriptSegments.map((seg) => (
                <div key={seg.id}>
                  <p className="font-medium text-muted-foreground">{seg.speakerName || "Speaker"}</p>
                  <p>{seg.text}</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Transcript not included.</p>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
