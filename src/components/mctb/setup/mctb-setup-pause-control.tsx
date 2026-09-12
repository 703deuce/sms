"use client";

import { addPauseUntil } from "@/lib/mctb/schedule-shared";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  paused: boolean;
  pauseUntil: string | null;
  pauseKind: "manual" | "timed" | null;
  timezone: string;
  onUpdated: () => void;
};

export function MctbSetupPauseControl({ paused, pauseUntil, pauseKind, timezone, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<"1h" | "tomorrow" | "24h" | "manual" | "custom">("1h");
  const [customAt, setCustomAt] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const postPause = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch("/api/mctb/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Request failed");
        setOpen(false);
        onUpdated();
      } finally {
        setBusy(false);
      }
    },
    [onUpdated],
  );

  async function confirmPause() {
    if (choice === "manual") {
      await postPause({ enabled: false, pauseUntil: null });
      return;
    }
    if (choice === "custom" && customAt) {
      await postPause({ pauseUntil: new Date(customAt).toISOString() });
      return;
    }
    const duration = choice === "24h" ? "24h" : choice === "tomorrow" ? "tomorrow" : "1h";
    const until =
      duration === "24h"
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : addPauseUntil(duration === "tomorrow" ? "tomorrow" : "1h", timezone);
    await postPause({ pauseUntil: until });
  }

  async function resume() {
    await postPause({ enabled: true, pauseUntil: null });
  }

  if (paused) {
    const label =
      pauseKind === "timed" && pauseUntil
        ? `Paused until ${new Date(pauseUntil).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}`
        : "Paused until manually resumed";
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-[#626872]">{label}</span>
        <button
          type="button"
          className="mctb-setup-btn mctb-setup-btn--primary"
          disabled={busy}
          onClick={() => void resume()}
        >
          Resume recovery
        </button>
      </div>
    );
  }

  return (
    <div className="mctb-setup-pause-wrap" ref={wrapRef}>
      <button
        type="button"
        className="mctb-setup-btn mctb-setup-btn--outline"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        Pause recovery ▾
      </button>
      {open ? (
        <div className="mctb-setup-pause-menu" role="dialog" aria-label="Pause recovery">
          <p className="font-semibold text-[13px] text-[#1b1e23]">Pause recovery</p>
          <label>
            <input
              type="radio"
              name="pause"
              checked={choice === "1h"}
              onChange={() => setChoice("1h")}
            />
            1 hour
          </label>
          <label>
            <input
              type="radio"
              name="pause"
              checked={choice === "tomorrow"}
              onChange={() => setChoice("tomorrow")}
            />
            Until tomorrow
          </label>
          <label>
            <input
              type="radio"
              name="pause"
              checked={choice === "24h"}
              onChange={() => setChoice("24h")}
            />
            24 hours
          </label>
          <label>
            <input
              type="radio"
              name="pause"
              checked={choice === "custom"}
              onChange={() => setChoice("custom")}
            />
            Choose date &amp; time
          </label>
          {choice === "custom" ? (
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-[#dee2e6] px-2 py-1 text-[13px]"
              value={customAt}
              onChange={(e) => setCustomAt(e.target.value)}
            />
          ) : null}
          <label>
            <input
              type="radio"
              name="pause"
              checked={choice === "manual"}
              onChange={() => setChoice("manual")}
            />
            Until I turn it back on
          </label>
          <p>
            While recovery is paused, no new recovery texts will be sent. Existing conversations are
            unaffected. Forwarded unanswered calls must still terminate through the configured
            voicemail path.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="mctb-setup-btn mctb-setup-btn--outline" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="mctb-setup-btn mctb-setup-btn--primary"
              disabled={busy || (choice === "custom" && !customAt)}
              onClick={() => void confirmPause()}
            >
              Pause recovery
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
