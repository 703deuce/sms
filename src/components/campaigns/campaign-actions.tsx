"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "activate" | "pause" | "resume" | "cancel";

type Props = {
  campaignId: string;
  status: string;
  variant?: "detail" | "row";
};

function normalizeStatus(status: string) {
  return status.toUpperCase().replace("CANCELLED", "CANCELED");
}

export function CampaignActions({ campaignId, status, variant = "detail" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [error, setError] = useState("");

  const normalized = normalizeStatus(status);
  const actions: Array<{ action: Action; label: string; variant: "default" | "outline" | "danger" }> = [];

  if (normalized === "DRAFT" || normalized === "SCHEDULED" || normalized === "PAUSED") {
    actions.push({
      action: normalized === "PAUSED" ? "resume" : "activate",
      label: normalized === "PAUSED" ? "Resume" : "Activate",
      variant: "default",
    });
  }
  if (normalized === "SENDING") {
    actions.push({ action: "pause", label: "Pause", variant: "outline" });
  }
  if (normalized !== "CANCELED" && normalized !== "COMPLETED" && normalized !== "FAILED") {
    actions.push({ action: "cancel", label: "Cancel", variant: "danger" });
  }

  async function runAction(action: Action) {
    if (action === "cancel" && !confirm("Cancel this campaign? Queued messages will be stopped.")) {
      return;
    }
    setLoading(action);
    setError("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(null);
    }
  }

  if (actions.length === 0) return null;

  const size = variant === "row" ? "sm" : "md";

  return (
    <div className={variant === "row" ? "flex flex-wrap gap-1" : "flex flex-wrap items-center gap-2"}>
      {actions.map((item) => (
        <Button
          key={item.action}
          type="button"
          size={size}
          variant={
            item.variant === "danger"
              ? "danger"
              : item.variant === "outline"
                ? "outline"
                : "primary"
          }
          disabled={loading !== null}
          onClick={() => runAction(item.action)}
        >
          {loading === item.action ? "…" : item.label}
        </Button>
      ))}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
