"use client";

import { useCallback, useState } from "react";
import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { saveMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import { addPauseUntil } from "@/lib/mctb/schedule-shared";

type Props = {
  paused: boolean;
  pauseUntil: string | null;
  pauseKind: "manual" | "timed" | null;
  timezone: string;
  onUpdated?: () => void;
  compact?: boolean;
};

export function MctbRecoveryPauseOpus({
  paused,
  pauseUntil,
  pauseKind,
  timezone,
  onUpdated,
  compact,
}: Props) {
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (patch: Record<string, unknown>) => {
      setBusy(true);
      try {
        await saveMctbSetup(patch);
        onUpdated?.();
      } finally {
        setBusy(false);
      }
    },
    [onUpdated],
  );

  const pauseLabel =
    pauseKind === "timed" && pauseUntil
      ? `Paused until ${new Date(pauseUntil).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}`
      : "Paused until you resume";

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium">Missed call recovery</p>
          <p className="text-xs text-muted-foreground">
            {paused
              ? "Calls still forward; voicemail fallback plays. No recovery texts."
              : "Automated recovery texts send after qualifying missed calls."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={paused ? "warning" : "success"}>{paused ? "Paused" : "Active"}</Pill>
          {paused ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => void run({ enabled: true, pauseUntil: null })}>
              Resume recovery
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void run({ enabled: false, pauseUntil: null })}
            >
              Pause recovery
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Panel title="Missed call recovery">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            Status <Pill tone={paused ? "warning" : "success"}>{paused ? "Paused" : "Active"}</Pill>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {paused
              ? `${pauseLabel}. Forwarded calls use your configured voicemail fallback — no recovery SMS.`
              : "Recovery texts send for qualifying missed calls per your rules."}
          </p>
        </div>
        {paused ? (
          <Button type="button" disabled={busy} onClick={() => void run({ enabled: true, pauseUntil: null })}>
            Resume recovery
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void run({ pauseUntil: addPauseUntil("1h", timezone) })}
            >
              Pause 1 hour
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void run({ enabled: false, pauseUntil: null })}
            >
              Pause until resumed
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
