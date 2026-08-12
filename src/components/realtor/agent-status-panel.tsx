"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { RealtorAgentInstanceStatus, RealtorProductConfig } from "@/lib/realtor/types";
import { validateRealtorProductConfig } from "@/lib/voice/real-estate/compile";
import { useMemo, useState } from "react";

const STATUS_LABELS: Record<RealtorAgentInstanceStatus, string> = {
  draft: "Draft",
  testing: "Testing",
  active: "Active",
  paused: "Paused",
};

export function RealtorAgentStatusPanel({
  config,
  agentLabel,
  onUpdated,
}: {
  config: RealtorProductConfig;
  agentLabel: "Front Desk" | "Speed-to-Lead";
  onUpdated?: (config: RealtorProductConfig) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const status = config.status || "draft";
  const validation = useMemo(() => validateRealtorProductConfig(config), [config]);
  const publishBlockers = useMemo(() => {
    const blockers = validation.errors.map((e) => e.message);
    if (
      agentLabel === "Front Desk" &&
      !config.phone.inboundNumberE164?.trim()
    ) {
      blockers.push("Select an inbound phone number before publishing.");
    }
    return blockers;
  }, [agentLabel, config.phone.inboundNumberE164, validation.errors]);

  async function runAction(action: string) {
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch("/api/realtor/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, config }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.validation?.errors?.length) {
          setErrors(json.validation.errors.map((e: { message: string }) => e.message));
        } else {
          setErrors([json.error || "Action failed"]);
        }
        return;
      }
      if (json.config) onUpdated?.(json.config);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{agentLabel} status</CardTitle>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
          {STATUS_LABELS[status]} · v{config.compiledVersion ?? 0}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Production calls use the last published configuration. Edits save as draft until you publish.
      </p>
      {errors.length ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void runAction("save_draft")}
        >
          Save draft
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void runAction("set_testing")}
        >
          Mark testing
        </Button>
        <Button
          size="sm"
          disabled={busy || publishBlockers.length > 0}
          onClick={() => void runAction("publish")}
        >
          Publish
        </Button>
        {status === "active" ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void runAction("pause")}>
            Pause
          </Button>
        ) : null}
      </div>
      {config.publishedAt ? (
        <p className="text-xs text-muted-foreground">
          Last published: {new Date(config.publishedAt).toLocaleString()}
        </p>
      ) : null}
    </Card>
  );
}
