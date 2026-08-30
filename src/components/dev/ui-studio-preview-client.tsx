"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "current" | "kimi" | "split";

type SessionPayload = {
  session: {
    id: string;
    target: string;
    status?: string;
    approved?: boolean;
    instruction?: string;
  };
  handoff?: { cursorInstruction?: string } | null;
  previewUrl: string;
};

export function UiStudioPreviewClient({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionPayload | null>(null);
  const [mode, setMode] = useState<Mode>("split");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/dev/ui-studio/${sessionId}`);
      if (!res.ok) {
        setError("Session not found");
        return;
      }
      setData((await res.json()) as SessionPayload);
    })();
  }, [sessionId]);

  const currentUrl = useMemo(() => {
    if (!data?.session.target) return null;
    return data.session.target;
  }, [data]);

  const kimiUrl = `/api/dev/ui-studio/preview/${sessionId}`;

  if (error) {
    return <div className="p-8 text-sm text-destructive">{error}</div>;
  }

  if (!data) {
    return <div className="p-8 text-sm text-muted-foreground">Loading session…</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">UI Studio Preview</h1>
          <p className="text-xs text-muted-foreground">
            {data.session.target} · {data.session.status || "ready"}
            {data.session.approved ? " · approved" : ""}
          </p>
        </div>
        <div className="flex rounded-lg border p-1 text-sm">
          {(["current", "kimi", "split"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 capitalize ${mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {(mode === "current" || mode === "split") && currentUrl ? (
          <div className={mode === "split" ? "flex min-h-0 w-1/2 flex-col border-r" : "min-h-0 flex-1"}>
            <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current Transovo
            </div>
            <iframe title="Current Transovo" src={currentUrl} className="min-h-0 flex-1 w-full bg-white" />
          </div>
        ) : null}

        {(mode === "kimi" || mode === "split") && (
          <div className={mode === "split" ? "flex min-h-0 w-1/2 flex-col" : "min-h-0 flex-1"}>
            <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Kimi Generated
            </div>
            <iframe title="Kimi generated" src={kimiUrl} className="min-h-0 flex-1 w-full bg-white" />
          </div>
        )}
      </div>

      {data.handoff?.cursorInstruction ? (
        <footer className="border-t px-4 py-2 text-xs text-muted-foreground">{data.handoff.cursorInstruction}</footer>
      ) : null}
    </div>
  );
}
