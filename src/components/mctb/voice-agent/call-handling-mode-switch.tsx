"use client";

import { Button } from "@/components/ui/button";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type HandlingPayload = {
  line: {
    inboundHandlingMode: "MCTB_RECOVERY" | "VOICE_AGENT";
    ingressE164: string;
    businessLineE164: string | null;
    voiceAgentId: string | null;
  } | null;
  modeLabel: string;
  activePrimaryHandler: "mctb_recovery" | "voice_agent";
  forwarding: {
    status: string;
    businessLineE164: string | null;
    ingressE164: string;
  } | null;
  voiceReadiness: { canAnswer: boolean; reasons: string[] } | null;
};

export function CallHandlingModeSwitch({
  voiceAgentId,
  agentReady,
}: {
  voiceAgentId?: string | null;
  agentReady?: boolean;
}) {
  const [data, setData] = useState<HandlingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/inbound-handling", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "load failed");
      setData(json.data as HandlingPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load call handling");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const voiceOn = data?.line?.inboundHandlingMode === "VOICE_AGENT";

  const switchMode = async (mode: "MCTB_RECOVERY" | "VOICE_AGENT") => {
    const confirmText =
      mode === "VOICE_AGENT"
        ? "Turn on After-Hours Voice Agent?\n\nYour existing call forwarding stays exactly the same.\nWhen your business doesn't answer, Transovo will let the Voice Agent answer instead of the normal Missed Call Text Back call flow.\n\nIf the Voice Agent is unavailable, Transovo will fall back to your existing recovery flow."
        : "Switch to Missed Call Text Back?\n\nYour forwarding will not change.\nForwarded calls will stop going to the AI Voice Agent and will use your existing Missed Call Text Back flow instead.";
    if (!window.confirm(confirmText)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/inbound-handling", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          voiceAgentId: voiceAgentId || data?.line?.voiceAgentId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const reasons = Array.isArray(json.blockingReasons)
          ? json.blockingReasons.join(", ")
          : json.error;
        throw new Error(reasons || "switch failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch mode");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mctb-va-handling-card animate-pulse rounded-xl border border-border bg-card p-4">
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="mt-2 h-3 w-48 rounded bg-muted" />
      </div>
    );
  }

  const forwardingLabel =
    data?.forwarding?.status === "connected" ? "Already connected" : "Pending verification";

  return (
    <section className="mctb-va-handling-card rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Call handling
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {voiceOn ? "After-Hours Voice Agent" : "Missed Call Text Back"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {voiceOn
              ? "Forwarded calls are answered by your AI agent on the same Transovo number."
              : "Forwarded calls use your existing Press-1 / recovery flow."}
          </p>
          {data?.forwarding ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Forwarding: <span className="font-medium text-foreground">{forwardingLabel}</span>
              {data.forwarding.businessLineE164 ? (
                <>
                  {" "}
                  · Business line {formatPhone(data.forwarding.businessLineE164)}
                </>
              ) : null}
              {data.forwarding.ingressE164 ? (
                <> · Transovo {formatPhone(data.forwarding.ingressE164)}</>
              ) : null}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            Already using Missed Call Text Back? Your current forwarding setup works with Voice Agent
            too — you don&apos;t need to change anything with your carrier.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {voiceOn ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void switchMode("MCTB_RECOVERY")}
            >
              Switch to Missed Call Text Back
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={busy || !agentReady}
              onClick={() => void switchMode("VOICE_AGENT")}
            >
              Turn on Voice Agent
            </Button>
          )}
          {!agentReady && !voiceOn ? (
            <Link
              href={`${MCTB_ROUTES.voiceAgent}?step=activate`}
              className="text-center text-xs text-primary underline"
            >
              Finish setup to enable
            </Link>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>
      ) : null}
    </section>
  );
}
