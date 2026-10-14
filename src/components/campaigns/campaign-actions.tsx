"use client";

import { campaignLooksLikeMassText } from "@/lib/campaigns/mass-text-detection";
import { Button } from "@/newui-transplant/components/ui/button";
import { AlertTriangle, Pause, Play, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export { campaignLooksLikeMassText };

type Action = "activate" | "pause" | "resume" | "cancel";

type Props = {
  campaignId: string;
  status: string;
  variant?: "detail" | "row";
  /** Mass Text drafts launch from pre-send review, not Activate. */
  isMassText?: boolean;
};

function normalizeStatus(status: string) {
  return status.toUpperCase().replace("CANCELLED", "CANCELED");
}

export function CampaignActions({
  campaignId,
  status,
  variant = "detail",
  isMassText = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [error, setError] = useState("");

  const normalized = normalizeStatus(status);
  const actions: Array<{
    action: Action;
    label: string;
    variant: "default" | "outline" | "danger";
  }> = [];

  const showActivate =
    normalized === "DRAFT" || normalized === "SCHEDULED" || normalized === "PAUSED";
  const hideMassTextActivate = isMassText && (normalized === "DRAFT" || normalized === "SCHEDULED");
  if (showActivate && !hideMassTextActivate) {
    actions.push({
      action: normalized === "PAUSED" ? "resume" : "activate",
      label: normalized === "PAUSED" ? "Resume" : "Activate",
      variant: "default",
    });
  }
  if (normalized === "SENDING") {
    actions.push({ action: "pause", label: "Pause", variant: "outline" });
  }
  if (
    normalized !== "CANCELED" &&
    normalized !== "COMPLETED" &&
    normalized !== "FAILED"
  ) {
    actions.push({ action: "cancel", label: "Cancel", variant: "danger" });
  }

  async function runAction(action: Action) {
    if (action === "cancel" && !confirm("Cancel this campaign? Queued messages will be stopped.")) {
      return;
    }
    setLoading(action);
    setError("");
    try {
      if (isMassText) {
        if (action === "cancel") {
          const res = await fetch(`/api/mass-texting/campaigns/${campaignId}`, {
            method: "DELETE",
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Action failed");
          router.refresh();
          return;
        }
        if (action === "pause" || action === "resume") {
          const res = await fetch(`/api/mass-texting/campaigns/${campaignId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Action failed");
          router.refresh();
          return;
        }
        if (action === "activate") {
          const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmLargeSend: true }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Action failed");
          router.refresh();
          return;
        }
      }
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

  const size = variant === "row" ? "sm" : "default";

  return (
    <div
      className={
        variant === "row" ? "flex flex-wrap gap-1" : "flex flex-wrap items-center gap-2"
      }
    >
      {actions.map((item) => (
        <Button
          key={item.action}
          type="button"
          size={size}
          variant={
            item.variant === "danger"
              ? "destructive"
              : item.variant === "outline"
                ? "outline"
                : "default"
          }
          disabled={loading !== null}
          onClick={() => runAction(item.action)}
        >
          {loading === item.action ? (
            "…"
          ) : (
            <>
              {item.action === "pause" ? (
                <Pause className="h-3.5 w-3.5" aria-hidden />
              ) : item.action === "cancel" ? (
                <XCircle className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden />
              )}
              {item.label}
            </>
          )}
        </Button>
      ))}
      {error ? (
        <p className="flex items-center gap-1 text-xs font-medium text-rose-600">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
